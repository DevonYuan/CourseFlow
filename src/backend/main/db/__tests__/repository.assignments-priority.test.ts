/**
 * Repository Tests — Assignments, Priority Order & Settings
 *
 * Raises coverage of the repository methods not exercised by the Phase 3
 * sub-task/note suites: assignment CRUD/lookup, priority ordering, and
 * settings reads.
 *
 * @module @backend/main/db/__tests__/repository.assignments-priority
 */

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import type { EntityId, IsoDateTime } from '../../../shared/types.js';
import { repo } from '../repository.js';

const mockState = vi.hoisted(() => ({
  db: null as unknown,
  sendEventToRenderers: vi.fn(),
}));

vi.mock('../connection.js', () => ({
  getDatabase: () => mockState.db,
  saveDatabase: () => {},
}));

vi.mock('../../events.js', () => ({
  sendEventToRenderers: mockState.sendEventToRenderers,
}));

let testDb: Database | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let counter = 0;

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
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'manual',
      source_url TEXT,
      rrule TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS priority_order (
      assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
      position INTEGER NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sub_tasks (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

interface AssignmentOverrides {
  title?: string;
  courseName?: string;
  dueAt?: string;
  icalUid?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'archived';
}

function makeAssignmentInput(id: string, overrides: AssignmentOverrides = {}) {
  counter++;
  return {
    id: id as EntityId,
    title: overrides.title ?? `Assignment ${counter}`,
    description: '',
    courseId: `course-${counter}` as EntityId,
    courseName: overrides.courseName ?? 'CS 101',
    courseColor: '#6366f1',
    dueAt: (overrides.dueAt ??
      new Date(Date.now() + counter * 86_400_000).toISOString()) as IsoDateTime,
    unlockAt: null,
    lockAt: null,
    pointsPossible: 100,
    submissionTypes: ['online_text_entry'],
    workflowState: 'published',
    htmlUrl: 'https://canvas.example.com/assignments/1',
    icalUid: overrides.icalUid ?? `uid-${counter}@canvas.example.com`,
    priority: 'medium' as const,
    status: overrides.status ?? ('pending' as const),
    source: 'ical' as const,
    sourceUrl: 'https://canvas.example.com/feeds/calendars/user.ics',
    createdAt: new Date().toISOString() as IsoDateTime,
    updatedAt: new Date().toISOString() as IsoDateTime,
  };
}

function seedAssignments(ids: string[]): void {
  for (const id of ids) repo.upsertAssignment(makeAssignmentInput(id));
}

describe('Repository — assignments, priority & settings', () => {
  beforeAll(async () => {
    testDb = await initTestDb();
    runMigrations(testDb);
    mockState.db = testDb;
  });

  afterAll(() => {
    mockState.db = null;
    if (testDb) {
      testDb.close();
      testDb = null;
    }
    SQL = null;
  });

  beforeEach(() => {
    counter = 0;
    mockState.sendEventToRenderers.mockClear();
    if (testDb) {
      testDb.exec('DELETE FROM priority_order');
      testDb.exec('DELETE FROM sub_tasks');
      testDb.exec('DELETE FROM notes');
      testDb.exec('DELETE FROM assignments');
      testDb.exec('DELETE FROM settings');
    }
  });

  describe('listAssignments / getAssignment', () => {
    it('lists assignments ordered by due date', () => {
      repo.upsertAssignment(makeAssignmentInput('a-late', { dueAt: '2030-01-10T00:00:00.000Z' }));
      repo.upsertAssignment(makeAssignmentInput('a-early', { dueAt: '2030-01-01T00:00:00.000Z' }));

      const list = repo.listAssignments();

      expect(list.map((a) => a.id)).toEqual(['a-early', 'a-late']);
    });

    it('returns null for an unknown assignment', () => {
      expect(repo.getAssignment('nope')).toBeNull();
    });
  });

  describe('findByICalUID', () => {
    it('finds an assignment by its iCal UID', () => {
      repo.upsertAssignment(makeAssignmentInput('a1', { icalUid: 'ical-abc@canvas.example.com' }));

      const found = repo.findByICalUID('ical-abc@canvas.example.com');

      expect(found?.id).toBe('a1');
      expect(repo.findByICalUID('missing')).toBeNull();
    });
  });

  describe('listAssignmentsByCourse', () => {
    it('returns only assignments for the given course', () => {
      repo.upsertAssignment(makeAssignmentInput('a1', { courseName: 'CS 101' }));
      repo.upsertAssignment(makeAssignmentInput('a2', { courseName: 'MATH 200' }));

      const list = repo.listAssignmentsByCourse('CS 101');

      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe('a1');
    });
  });

  describe('upsertAssignment', () => {
    it('inserts then applies a partial update', () => {
      const created = repo.upsertAssignment(makeAssignmentInput('a1', { title: 'First' }));
      expect(created.title).toBe('First');

      const updated = repo.upsertAssignment({ id: 'a1' as EntityId, status: 'completed' });

      expect(updated.status).toBe('completed');
      expect(updated.title).toBe('First');
    });
  });

  describe('updateAssignmentStatus', () => {
    it('updates the status and emits db:changed', () => {
      repo.upsertAssignment(makeAssignmentInput('a1'));

      const updated = repo.updateAssignmentStatus('a1', 'in_progress');

      expect(updated?.status).toBe('in_progress');
      expect(mockState.sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'assignments',
        action: 'update',
        id: 'a1',
      });
    });

    it('returns null for an unknown assignment', () => {
      expect(repo.updateAssignmentStatus('missing', 'completed')).toBeNull();
    });
  });

  describe('bulkUpsertAssignments', () => {
    it('inserts multiple assignments in one transaction', () => {
      const result = repo.bulkUpsertAssignments([
        makeAssignmentInput('b1'),
        makeAssignmentInput('b2'),
      ]);

      expect(result).toHaveLength(2);
      expect(repo.listAssignments()).toHaveLength(2);
    });
  });

  describe('priority order', () => {
    it('upserts, lists (ordered), and reads a priority entry', () => {
      seedAssignments(['p1', 'p2']);
      repo.upsertPriorityOrder({ assignmentId: 'p1' as EntityId, order: 1 });
      repo.upsertPriorityOrder({ assignmentId: 'p2' as EntityId, order: 0 });

      const all = repo.getAllPriorityOrders();
      expect(all.map((p) => p.assignmentId)).toEqual(['p2', 'p1']);

      expect(repo.getPriorityOrderByAssignmentId('p1')?.order).toBe(1);
      expect(repo.getPriorityOrderByAssignmentId('missing')).toBeNull();
    });

    it('updates the position on conflict', () => {
      seedAssignments(['p1']);
      repo.upsertPriorityOrder({ assignmentId: 'p1' as EntityId, order: 5 });

      const updated = repo.upsertPriorityOrder({ assignmentId: 'p1' as EntityId, order: 2 });

      expect(updated.order).toBe(2);
      expect(repo.getAllPriorityOrders()).toHaveLength(1);
    });

    it('reorders priority entries by the provided id order', () => {
      seedAssignments(['p1', 'p2', 'p3']);
      repo.upsertPriorityOrder({ assignmentId: 'p1' as EntityId, order: 0 });
      repo.upsertPriorityOrder({ assignmentId: 'p2' as EntityId, order: 1 });
      repo.upsertPriorityOrder({ assignmentId: 'p3' as EntityId, order: 2 });

      repo.reorderPriority(['p3', 'p1', 'p2']);

      expect(repo.getAllPriorityOrders().map((p) => p.assignmentId)).toEqual(['p3', 'p1', 'p2']);
    });

    it('deletes a priority entry', () => {
      seedAssignments(['p1']);
      repo.upsertPriorityOrder({ assignmentId: 'p1' as EntityId, order: 0 });

      repo.deletePriorityOrder('p1');

      expect(repo.getPriorityOrderByAssignmentId('p1')).toBeNull();
    });
  });

  describe('getSetting', () => {
    it('returns the fallback when the key is missing', async () => {
      await expect(repo.getSetting('missing', 'fallback')).resolves.toBe('fallback');
    });

    it('returns the stored value', async () => {
      if (testDb) {
        testDb.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme', '"dark"']);
      }
      await expect(repo.getSetting('theme', 'system')).resolves.toBe('dark');
    });
  });
});
