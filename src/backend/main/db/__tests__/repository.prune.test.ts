/**
 * Repository Import Pruning Tests
 *
 * Tests that repo.importAssignments keeps the assignments table in sync with
 * the iCal feed + mapper window:
 * - Stale ical rows not present in the import batch are pruned
 * - Completed/archived ical rows are preserved
 * - Manual rows are never pruned
 * - Legacy collapsed recurring "master" rows are replaced by expanded
 *   per-occurrence rows
 *
 * @module @backend/main/db/__tests__/repository.prune
 */

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock Electron modules (before importing modules that depend on them)
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import type { AssignmentInput, EntityId, IsoDateTime } from '../../../shared/types.js';
import { getDatabase, setTestDatabase } from '../connection.js';
import { repo } from '../repository.js';

// Test database instance
let testDb: Database | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function initTestDb(): Promise<Database> {
  if (SQL === null) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const wasmPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm',
    );
    const wasmBuffer = fs.readFileSync(wasmPath);
    SQL = await initSqlJs({ wasmBinary: new Uint8Array(wasmBuffer).buffer });
  }
  const db = new SQL.Database();
  return db;
}

function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      canvas_id TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      course_name TEXT NOT NULL,
      course_color TEXT,
      due_at INTEGER NOT NULL,
      unlock_at INTEGER,
      lock_at INTEGER,
      points_possible REAL,
      submission_types TEXT,
      workflow_state TEXT,
      html_url TEXT,
      ical_uid TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')) DEFAULT 'pending',
      source TEXT CHECK (source IN ('manual', 'ical')) DEFAULT 'manual',
      source_url TEXT,
      rrule TEXT,
      source_id TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_source_ical ON assignments(source_id, ical_uid);
    CREATE TABLE IF NOT EXISTS priority_order (
      assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
      position INTEGER NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      color TEXT NOT NULL,
      position INTEGER NOT NULL,
      last_sync_at INTEGER,
      next_sync_at INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_source_ical ON assignments(source_id, ical_uid);
  `);
}

interface SeedRow {
  id: string;
  icalUid: string;
  title?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'archived';
  source?: 'manual' | 'ical';
  dueAtMs?: number;
  sourceUrl?: string | null;
}

let rowCounter = 0;

/**
 * Insert a row directly into the test assignments table.
 * Column order matches the test's runMigrations CREATE TABLE.
 */
function seedRow(db: Database, row: SeedRow): void {
  rowCounter++;
  const now = Date.now();
  db.run(
    `INSERT INTO assignments (id, canvas_id, title, description, course_name, course_color, due_at,
       unlock_at, lock_at, points_possible, submission_types, workflow_state, html_url, ical_uid,
       created_at, updated_at, status, source, source_url, rrule, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      null,
      row.title ?? 'Seeded Assignment',
      '',
      'Test Course',
      '#6366f1',
      row.dueAtMs ?? now + 7 * 86_400_000,
      null,
      null,
      null,
      '[]',
      'published',
      '',
      row.icalUid,
      now,
      now,
      row.status ?? 'pending',
      row.source ?? 'ical',
      row.sourceUrl ?? 'https://calendar.example.com/basic.ics',
      null,
      null,
    ],
  );
}

function makeInput(icalUid: string, overrides: Partial<AssignmentInput> = {}): AssignmentInput {
  const now = Date.now();
  rowCounter++;
  return {
    id: `input-${rowCounter}` as EntityId,
    title: 'Imported Assignment',
    description: '',
    courseName: 'Test Course',
    courseColor: '#6366f1',
    dueAt: new Date(now + 7 * 86_400_000).toISOString() as IsoDateTime,
    unlockAt: null,
    lockAt: null,
    pointsPossible: null,
    submissionTypes: [],
    workflowState: 'published',
    htmlUrl: '',
    icalUid,
    priority: 'low',
    status: 'pending',
    source: 'ical',
    sourceUrl: 'https://calendar.example.com/basic.ics',
    createdAt: new Date(now).toISOString() as IsoDateTime,
    // Use a future timestamp to ensure it's newer than seeded rows
    updatedAt: new Date(now + 1000).toISOString() as IsoDateTime,
    ...overrides,
  };
}

function getIcalUids(db: Database): string[] {
  const rows = db.exec('SELECT ical_uid FROM assignments ORDER BY ical_uid');
  if (rows.length === 0) return [];
  return rows[0]!.values.map((row) => String(row[0]));
}

describe('importAssignments pruning', () => {
  beforeAll(async () => {
    testDb = await initTestDb();
    runMigrations(testDb);
    setTestDatabase(testDb);
  });

  afterAll(() => {
    setTestDatabase(null);
  });

  beforeEach(() => {
    // Reset tables between tests
    testDb!.exec('DELETE FROM assignments');
    testDb!.exec('DELETE FROM priority_order');
  });

  it('prunes stale pending ical rows that are not in the import batch', () => {
    const db = getDatabase();
    // A row that fell outside the mapper window / disappeared from the feed
    seedRow(db, {
      id: 'stale-1',
      icalUid: 'stale@google.com',
      dueAtMs: Date.now() - 365 * 86_400_000,
    });

    const result = repo.importAssignments([makeInput('current-1')]);

    expect(result.imported).toBe(1);
    expect(getIcalUids(db)).toEqual(['current-1']);
  });

  it('keeps rows that ARE in the import batch (update path)', () => {
    const db = getDatabase();
    seedRow(db, { id: 'keep-1', icalUid: 'keep-1', title: 'Old Title' });

    const result = repo.importAssignments([
      makeInput('keep-1', {
        title: 'New Title',
        updatedAt: new Date(Date.now() + 60_000).toISOString() as IsoDateTime,
        dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() as IsoDateTime,
      }),
    ]);

    expect(result.updated).toBe(1);
    const uids = getIcalUids(db);
    expect(uids).toEqual(['keep-1']);
  });

  it('preserves completed ical rows even when not in the batch', () => {
    const db = getDatabase();
    seedRow(db, { id: 'done-1', icalUid: 'done@google.com', status: 'completed' });

    repo.importAssignments([makeInput('current-2')]);

    const uids = getIcalUids(db).sort();
    expect(uids).toEqual(['current-2', 'done@google.com']);
  });

  it('preserves archived ical rows even when not in the batch', () => {
    const db = getDatabase();
    seedRow(db, { id: 'arch-1', icalUid: 'archived@google.com', status: 'archived' });

    repo.importAssignments([makeInput('current-3')]);

    const uids = getIcalUids(db).sort();
    expect(uids).toEqual(['archived@google.com', 'current-3']);
  });

  it('never prunes manual assignments', () => {
    const db = getDatabase();
    seedRow(db, { id: 'manual-1', icalUid: 'manual-1', source: 'manual', status: 'pending' });

    repo.importAssignments([makeInput('current-4')]);

    const uids = getIcalUids(db).sort();
    expect(uids).toEqual(['current-4', 'manual-1']);
  });

  it('replaces a legacy collapsed recurring master with expanded occurrences', () => {
    const db = getDatabase();
    // Old behavior collapsed a recurring series into one row with the master UID
    seedRow(db, { id: 'legacy-master', icalUid: 'series@google.com', status: 'pending' });

    const now = Date.now();
    const result = repo.importAssignments([
      makeInput('series@google.com@2026-09-06T15:00:00.000Z', {
        title: 'Weekly Class',
        rrule: 'FREQ=WEEKLY',
        dueAt: new Date(now + 2 * 86_400_000).toISOString() as IsoDateTime,
      }),
      makeInput('series@google.com@2026-09-13T15:00:00.000Z', {
        title: 'Weekly Class',
        rrule: 'FREQ=WEEKLY',
        dueAt: new Date(now + 9 * 86_400_000).toISOString() as IsoDateTime,
      }),
    ]);

    expect(result.imported).toBe(2);
    const uids = getIcalUids(db).sort();
    // Master gone, both occurrences present
    expect(uids).toEqual([
      'series@google.com@2026-09-06T15:00:00.000Z',
      'series@google.com@2026-09-13T15:00:00.000Z',
    ]);
    expect(uids).not.toContain('series@google.com');
  });

  it('getAssignment reads back a complete row (sql.js step regression)', () => {
    const db = getDatabase();
    seedRow(db, { id: 'readback-1', icalUid: 'readback@google.com', title: 'Readback' });

    const assignment = repo.getAssignment('readback-1');
    expect(assignment).not.toBeNull();
    expect(assignment!.title).toBe('Readback');
    expect(assignment!.dueAt).toBeDefined();
    expect(assignment!.icalUid).toBe('readback@google.com');
  });

  it('partial upsert updates status without touching other columns (mark-complete)', () => {
    const db = getDatabase();
    seedRow(db, { id: 'mc-1', icalUid: 'mc@google.com', title: 'Mark Me' });

    const updated = repo.upsertAssignment({
      id: 'mc-1' as EntityId,
      status: 'completed',
      updatedAt: new Date(Date.now() + 60_000).toISOString() as IsoDateTime,
    });

    expect(updated.status).toBe('completed');
    expect(updated.title).toBe('Mark Me');
    expect(updated.dueAt).toBeDefined();
  });
});

/**
 * Per-Source Import Tests
 *
 * Tests that importAssignments correctly scopes dedupe and prune to a specific calendar source.
 * This ensures multiple calendars can share the same iCal UIDs without conflicts.
 */
describe('importAssignments per-source', () => {
  beforeAll(async () => {
    testDb = await initTestDb();
    runMigrations(testDb);
    setTestDatabase(testDb);
  });

  afterAll(() => {
    setTestDatabase(null);
  });

  beforeEach(() => {
    // Reset tables between tests
    testDb!.exec('DELETE FROM assignments');
    testDb!.exec('DELETE FROM priority_order');
    testDb!.exec('DELETE FROM calendars');
  });

  function seedCalendar(db: Database, id: string, name: string): void {
    const now = Date.now();
    db.run(
      `INSERT INTO calendars (id, name, feed_url, enabled, color, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, 'encrypted-url', 1, '#6366f1', 0, now, now],
    );
  }

  function seedRowWithSource(db: Database, row: SeedRow & { sourceId?: string | null }): void {
    rowCounter++;
    const now = Date.now();
    db.run(
      `INSERT INTO assignments (id, canvas_id, title, description, course_name, course_color, due_at,
         unlock_at, lock_at, points_possible, submission_types, workflow_state, html_url, ical_uid,
         created_at, updated_at, status, source, source_url, rrule, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        null,
        row.title ?? 'Seeded Assignment',
        '',
        'Test Course',
        '#6366f1',
        row.dueAtMs ?? now + 7 * 86_400_000,
        null,
        null,
        null,
        '[]',
        'published',
        '',
        row.icalUid,
        now,
        now,
        row.status ?? 'pending',
        row.source ?? 'ical',
        row.sourceUrl ?? 'https://calendar.example.com/basic.ics',
        null,
        row.sourceId ?? null,
      ],
    );
  }

  function makeInputWithSource(
    icalUid: string,
    sourceId: string,
    overrides: Partial<AssignmentInput> = {},
  ): AssignmentInput {
    const now = Date.now();
    rowCounter++;
    return {
      id: `input-${rowCounter}` as EntityId,
      title: 'Imported Assignment',
      description: '',
      courseName: 'Test Course',
      courseColor: '#6366f1',
      dueAt: new Date(now + 7 * 86_400_000).toISOString() as IsoDateTime,
      unlockAt: null,
      lockAt: null,
      pointsPossible: null,
      submissionTypes: [],
      workflowState: 'published',
      htmlUrl: '',
      icalUid,
      priority: 'low',
      status: 'pending',
      source: 'ical',
      sourceUrl: 'https://calendar.example.com/basic.ics',
      sourceId,
      createdAt: new Date(now).toISOString() as IsoDateTime,
      // Use a future timestamp to ensure it's newer than seeded rows
      updatedAt: new Date(now + 1000).toISOString() as IsoDateTime,
      ...overrides,
    };
  }

  function getIcalUidsForSource(db: Database, sourceId: string): string[] {
    const rows = db.exec(
      `SELECT ical_uid FROM assignments WHERE source_id = ? ORDER BY ical_uid`,
      [sourceId],
    );
    if (rows.length === 0) return [];
    return rows[0]!.values.map((row) => String(row[0]));
  }

  it('deduplicates by (source_id, ical_uid) composite key', () => {
    const db = getDatabase();
    // Seed two calendars
    seedCalendar(db, 'cal-1', 'Calendar 1');
    seedCalendar(db, 'cal-2', 'Calendar 2');

    // Both calendars have an event with the same ical_uid
    seedRowWithSource(db, { id: 'a1', icalUid: 'same-uid@google.com', sourceId: 'cal-1' });
    seedRowWithSource(db, { id: 'a2', icalUid: 'same-uid@google.com', sourceId: 'cal-2' });

    // Import for cal-1 with the same UID - should update cal-1's row, not affect cal-2
    const result = repo.importAssignments(
      [makeInputWithSource('same-uid@google.com', 'cal-1', { title: 'Updated for Cal 1' })],
      'cal-1',
    );

    expect(result.updated).toBe(1);
    expect(result.imported).toBe(0);

    // cal-1 should have the updated title
    const cal1Rows = db.exec(`SELECT title FROM assignments WHERE source_id = 'cal-1'`);
    expect(cal1Rows.length).toBeGreaterThan(0);
    // values is SqlValue[][] - first row, first column
    const cal1Title = cal1Rows[0]!.values[0] as unknown[];
    expect(cal1Title[0]).toBe('Updated for Cal 1');

    // cal-2 should be unchanged
    const cal2Rows = db.exec(`SELECT title FROM assignments WHERE source_id = 'cal-2'`);
    expect(cal2Rows.length).toBeGreaterThan(0);
    const cal2Title = cal2Rows[0]!.values[0] as unknown[];
    expect(cal2Title[0]).toBe('Seeded Assignment');
  });

  it('prunes only stale rows for the given source', () => {
    const db = getDatabase();
    seedCalendar(db, 'cal-1', 'Calendar 1');
    seedCalendar(db, 'cal-2', 'Calendar 2');

    // Both calendars have events
    seedRowWithSource(db, { id: 'a1', icalUid: 'stale@google.com', sourceId: 'cal-1' });
    seedRowWithSource(db, { id: 'a2', icalUid: 'keep@google.com', sourceId: 'cal-1' });
    seedRowWithSource(db, { id: 'b1', icalUid: 'stale@google.com', sourceId: 'cal-2' });
    seedRowWithSource(db, { id: 'b2', icalUid: 'keep@google.com', sourceId: 'cal-2' });

    // Import only for cal-1 with 'keep' UID - should prune cal-1's 'stale' but not cal-2's
    repo.importAssignments([makeInputWithSource('keep@google.com', 'cal-1')], 'cal-1');

    // cal-1 should only have 'keep'
    expect(getIcalUidsForSource(db, 'cal-1')).toEqual(['keep@google.com']);

    // cal-2 should still have both
    expect(getIcalUidsForSource(db, 'cal-2').sort()).toEqual(['keep@google.com', 'stale@google.com']);
  });

  it('preserves completed rows for the given source only', () => {
    const db = getDatabase();
    seedCalendar(db, 'cal-1', 'Calendar 1');
    seedCalendar(db, 'cal-2', 'Calendar 2');

    // cal-1 has a completed row with UID 'done'
    seedRowWithSource(db, { id: 'a1', icalUid: 'done@google.com', status: 'completed', sourceId: 'cal-1' });
    // cal-2 has a pending row with same UID
    seedRowWithSource(db, { id: 'b1', icalUid: 'done@google.com', status: 'pending', sourceId: 'cal-2' });

    // Import for cal-1 without 'done' UID - should preserve cal-1's completed row
    repo.importAssignments([makeInputWithSource('keep@google.com', 'cal-1')], 'cal-1');

    expect(getIcalUidsForSource(db, 'cal-1').sort()).toEqual(['done@google.com', 'keep@google.com']);

    // cal-2 should be unchanged (not imported for cal-2)
    expect(getIcalUidsForSource(db, 'cal-2')).toEqual(['done@google.com']);
  });

  it('imports new rows with source_id set correctly', () => {
    const db = getDatabase();
    seedCalendar(db, 'cal-1', 'Calendar 1');

    const result = repo.importAssignments(
      [makeInputWithSource('new-uid@google.com', 'cal-1', { title: 'New Assignment' })],
      'cal-1',
    );

    expect(result.imported).toBe(1);

    const row = db.exec(
      `SELECT title, source_id FROM assignments WHERE ical_uid = 'new-uid@google.com'`,
    );
    expect(row.length).toBeGreaterThan(0);
    const row0 = row[0]!.values[0] as unknown[];
    expect(row0[0]).toBe('New Assignment');
    expect(row0[1]).toBe('cal-1');
  });

  it('handles multiple sources in sequence without cross-contamination', () => {
    const db = getDatabase();
    seedCalendar(db, 'cal-1', 'Calendar 1');
    seedCalendar(db, 'cal-2', 'Calendar 2');
    seedCalendar(db, 'cal-3', 'Calendar 3');

    // Import for cal-1
    repo.importAssignments([makeInputWithSource('uid-1@google.com', 'cal-1')], 'cal-1');
    // Import for cal-2
    repo.importAssignments([makeInputWithSource('uid-2@google.com', 'cal-2')], 'cal-2');
    // Import for cal-3
    repo.importAssignments([makeInputWithSource('uid-3@google.com', 'cal-3')], 'cal-3');

    // Each source should have only its own assignment
    expect(getIcalUidsForSource(db, 'cal-1')).toEqual(['uid-1@google.com']);
    expect(getIcalUidsForSource(db, 'cal-2')).toEqual(['uid-2@google.com']);
    expect(getIcalUidsForSource(db, 'cal-3')).toEqual(['uid-3@google.com']);

    // Total count should be 3
    const total = db.exec(`SELECT COUNT(*) as count FROM assignments WHERE source = 'ical'`);
    expect(total.length).toBeGreaterThan(0);
    const totalRow = total[0]!.values[0] as unknown[];
    expect(totalRow[0]).toBe(3);
  });

  it('backward compat: global import (no sourceId) still works for legacy data', () => {
    const db = getDatabase();
    // Legacy data without source_id
    seedRowWithSource(db, { id: 'legacy-1', icalUid: 'legacy@google.com', sourceId: null });
    seedRowWithSource(db, { id: 'legacy-2', icalUid: 'legacy-2@google.com', sourceId: null });

    // Import without sourceId (legacy behavior)
    const result = repo.importAssignments([makeInput('legacy@google.com', { title: 'Updated Legacy' })]);

    expect(result.updated).toBe(1);
    const row = db.exec(`SELECT title FROM assignments WHERE ical_uid = 'legacy@google.com'`);
    expect(row.length).toBeGreaterThan(0);
    const row0 = row[0]!.values[0] as unknown[];
    expect(row0[0]).toBe('Updated Legacy');
  });
});
