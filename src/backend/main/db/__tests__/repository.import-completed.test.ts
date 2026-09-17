/**
 * Repository Import — Completed Assignment Regression
 *
 * Reproduces the bug where re-importing a batch that contains an assignment
 * the user already marked `completed` aborted the whole transaction.
 *
 * sql.js `db.export()` (called by `saveDatabase`) frees every prepared
 * statement and closes/reopens the connection. The import transaction used to
 * call `saveDatabase()` mid-transaction when restoring the preserved
 * `completed` status, which surfaced as:
 *   "Statement closed" + "cannot rollback - no transaction is active"
 * Every import then rolled back, `lastSyncAt` never advanced, and new calendar
 * events never appeared.
 *
 * This test injects a test database WITH a file path so `saveDatabase()`
 * performs a real `db.export()`, exactly like production.
 *
 * @module @backend/main/db/__tests__/repository.import-completed
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

let testDb: Database | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let tempDir = '';
let dbFilePath = '';

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
  return new SQL.Database();
}

function createSchema(db: Database): void {
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
      rrule TEXT,
      source_id TEXT REFERENCES calendars(id)
    );
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
  `);
}

function seedRow(
  db: Database,
  row: { id: string; icalUid: string; title: string; status: 'pending' | 'completed' },
): void {
  const now = Date.now();
  db.run(
    `INSERT INTO assignments (id, canvas_id, title, description, course_name, course_color, due_at,
       unlock_at, lock_at, points_possible, submission_types, workflow_state, html_url, ical_uid,
       status, source, source_url, rrule, created_at, updated_at)
     VALUES (?, NULL, ?, '', 'Test Course', '#6366f1', ?, NULL, NULL, NULL, '[]', 'published', '', ?,
       ?, 'ical', 'https://calendar.example.com/basic.ics', NULL, ?, ?)`,
    [row.id, row.title, now + 7 * 86_400_000, row.icalUid, row.status, now, now],
  );
}

let counter = 0;

function makeInput(icalUid: string, overrides: Partial<AssignmentInput> = {}): AssignmentInput {
  const now = Date.now();
  counter++;
  return {
    id: `input-${counter}` as EntityId,
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

function getTitleByUid(db: Database, icalUid: string): string | undefined {
  const rows = db.exec('SELECT title FROM assignments WHERE ical_uid = ?', [icalUid]);
  return rows.length === 0 ? undefined : String(rows[0]!.values[0]![0]);
}

describe('importAssignments with a completed assignment in the batch', () => {
  beforeAll(async () => {
    testDb = await initTestDb();
    createSchema(testDb);
    tempDir = mkdtempSync(join(tmpdir(), 'courseflow-import-'));
    dbFilePath = join(tempDir, 'test.db');
    // Provide a real path so saveDatabase() performs a real db.export().
    setTestDatabase(testDb, dbFilePath);
  });

  afterAll(() => {
    setTestDatabase(null);
    rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    const db = getDatabase();
    db.exec('DELETE FROM assignments');
    db.exec('DELETE FROM priority_order');
  });

  it('commits the batch and preserves the completed status', () => {
    const db = getDatabase();
    seedRow(db, {
      id: 'done-1',
      icalUid: 'done@google.com',
      title: 'Old Title',
      status: 'completed',
    });

    const result = repo.importAssignments([
      makeInput('done@google.com', {
        title: 'Rescheduled Title',
        updatedAt: new Date(Date.now() + 60_000).toISOString() as IsoDateTime,
        dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() as IsoDateTime,
      }),
      makeInput('new@google.com', { title: 'Brand New Event' }),
    ]);

    // Previously the transaction aborted and neither the update nor the insert applied.
    expect(result.updated).toBe(1);
    expect(result.imported).toBe(1);

    const completed = repo.getAssignment('done-1');
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed'); // user's status preserved
    expect(completed!.title).toBe('Rescheduled Title'); // feed fields still updated

    expect(getTitleByUid(db, 'new@google.com')).toBe('Brand New Event');

    // The committed transaction was flushed to disk, not just kept in memory.
    const persisted = new SQL!.Database(readFileSync(dbFilePath));
    const persistedRows = persisted.exec(
      "SELECT title FROM assignments WHERE ical_uid = 'new@google.com'",
    );
    expect(String(persistedRows[0]!.values[0]![0])).toBe('Brand New Event');
  });
});
