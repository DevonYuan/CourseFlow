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
      ical_uid TEXT UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')) DEFAULT 'pending',
      source TEXT CHECK (source IN ('manual', 'ical')) DEFAULT 'manual',
      source_url TEXT,
      rrule TEXT
    );
    CREATE TABLE IF NOT EXISTS priority_order (
      assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
      position INTEGER NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
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
 */
function seedRow(db: Database, row: SeedRow): void {
  rowCounter++;
  const now = Date.now();
  db.run(
    `INSERT INTO assignments (id, canvas_id, title, description, course_name, course_color, due_at,
       unlock_at, lock_at, points_possible, submission_types, workflow_state, html_url, ical_uid,
       status, source, source_url, rrule, created_at, updated_at)
     VALUES (?, NULL, ?, '', 'Test Course', '#6366f1', ?, NULL, NULL, NULL, '[]', 'published', '', ?,
       ?, ?, ?, NULL, ?, ?)`,
    [
      row.id,
      row.title ?? 'Seeded Assignment',
      row.dueAtMs ?? now + 7 * 86_400_000,
      row.icalUid,
      row.status ?? 'pending',
      row.source ?? 'ical',
      row.sourceUrl ?? 'https://calendar.example.com/basic.ics',
      now,
      now,
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
    updatedAt: new Date(now).toISOString() as IsoDateTime,
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
    seedRow(db, { id: 'stale-1', icalUid: 'stale@google.com', dueAtMs: Date.now() - 365 * 86_400_000 });

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
});
