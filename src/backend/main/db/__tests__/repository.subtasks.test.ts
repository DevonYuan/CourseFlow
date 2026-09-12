/**
 * SubTask Repository Tests
 *
 * Tests for all sub-task CRUD operations:
 * - listSubTasks: fetch by assignment
 * - getSubTask: fetch by ID
 * - upsertSubTask: create/update
 * - deleteSubTask: delete by ID
 * - reorderSubTasks: bulk reorder with transaction
 * - updateSubTask: partial update
 *
 * @module @backend/main/db/__tests__/repository.subtasks
 */

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import type { EntityId } from '../../../shared/types.js';
import { repo } from '../repository.js';

// The repository reads the database and emits events through these modules.
// Inject a test database and a spy so the real repository logic runs in isolation.
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

// Test database instance
let testDb: Database | null = null;

// Load sql.js WASM
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
      title TEXT NOT NULL,
      due_at INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'manual'
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
  `);
}

let assignmentCounter = 0;
let subTaskCounter = 0;

function createAssignmentId(): EntityId {
  assignmentCounter++;
  return `assignment-${assignmentCounter}` as EntityId;
}

describe('SubTask Repository', () => {
  beforeAll(async () => {
    testDb = await initTestDb();
    runMigrations(testDb!);
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
    assignmentCounter = 0;
    subTaskCounter = 0;
    mockState.sendEventToRenderers.mockClear();
    if (testDb) {
      testDb.exec('DELETE FROM sub_tasks');
      testDb.exec('DELETE FROM notes');
      testDb.exec('DELETE FROM assignments');
    }
  });

  describe('listSubTasks', () => {
    it('should return empty array for assignment with no sub-tasks', () => {
      const assignmentId = createAssignmentId();

      const result = repo.listSubTasks(assignmentId);

      expect(result).toEqual([]);
    });

    it('should return all sub-tasks for an assignment ordered by position', () => {
      const assignmentId = createAssignmentId();

      // Insert sub-tasks directly into DB for test setup
      const now = Date.now();
      testDb!.exec(`
        INSERT INTO sub_tasks (id, assignment_id, title, completed, position, created_at, updated_at)
        VALUES 
          ('sub-1', '${assignmentId}', 'First sub-task', 0, 2, ${now}, ${now}),
          ('sub-2', '${assignmentId}', 'Second sub-task', 1, 0, ${now}, ${now}),
          ('sub-3', '${assignmentId}', 'Third sub-task', 0, 1, ${now}, ${now})
      `);

      const result = repo.listSubTasks(assignmentId);

      expect(result).toHaveLength(3);
      // Ordered by position
      expect(result[0]!.title).toBe('Second sub-task');
      expect(result[0]!.completed).toBe(true);
      expect(result[1]!.title).toBe('Third sub-task');
      expect(result[2]!.title).toBe('First sub-task');
    });

    it('should return only sub-tasks for the specified assignment', () => {
      const assignment1Id = createAssignmentId();
      const assignment2Id = createAssignmentId();

      const now = Date.now();
      testDb!.exec(`
        INSERT INTO sub_tasks (id, assignment_id, title, completed, position, created_at, updated_at)
        VALUES 
          ('sub-1', '${assignment1Id}', 'Assignment 1 sub-task', 0, 0, ${now}, ${now}),
          ('sub-2', '${assignment2Id}', 'Assignment 2 sub-task', 0, 0, ${now}, ${now})
      `);

      const result = repo.listSubTasks(assignment1Id);

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Assignment 1 sub-task');
    });
  });

  describe('getSubTask', () => {
    it('should return null for non-existent sub-task', () => {
      const result = repo.getSubTask('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return the sub-task for a valid ID', () => {
      const assignmentId = createAssignmentId();
      const subTaskId = `subtask-${subTaskCounter + 1}` as EntityId;
      const now = Date.now();

      testDb!.exec(`
        INSERT INTO sub_tasks (id, assignment_id, title, completed, position, created_at, updated_at)
        VALUES ('${subTaskId}', '${assignmentId}', 'Target sub-task', 0, 0, ${now}, ${now})
      `);

      const result = repo.getSubTask(subTaskId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(subTaskId);
      expect(result!.assignmentId).toBe(assignmentId);
      expect(result!.title).toBe('Target sub-task');
    });
  });

  describe('upsertSubTask', () => {
    it('should create a new sub-task with generated ID', () => {
      const assignmentId = createAssignmentId();

      const result = repo.upsertSubTask({
        assignmentId,
        title: 'New sub-task',
        completed: false,
        order: 0,
      });

      expect(result.id).toBeDefined();
      expect(result.assignmentId).toBe(assignmentId);
      expect(result.title).toBe('New sub-task');
      expect(result.completed).toBe(false);
      expect(result.order).toBe(0);
    });

    it('should update an existing sub-task', () => {
      const assignmentId = createAssignmentId();

      // Create initial sub-task
      const initial = repo.upsertSubTask({
        assignmentId,
        title: 'Initial title',
        completed: false,
        order: 0,
      });

      // Update via updateSubTask with same ID
      const updated = repo.updateSubTask(initial.id, {
        title: 'Updated title',
        completed: true,
        position: 1,
      });

      expect(updated!.id).toBe(initial.id);
      expect(updated!.title).toBe('Updated title');
      expect(updated!.completed).toBe(true);
      expect(updated!.order).toBe(1);
    });

    it('should accept an explicit order and persist it', () => {
      const assignmentId = createAssignmentId();

      const result = repo.upsertSubTask({
        assignmentId,
        title: 'Ordered sub-task',
        completed: false,
        order: 7,
      });

      expect(result.id).toBeDefined();
      expect(result.order).toBe(7);
    });
  });

  describe('deleteSubTask', () => {
    it('should delete an existing sub-task', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertSubTask({
        assignmentId,
        title: 'To be deleted',
        completed: false,
        order: 0,
      });

      repo.deleteSubTask(created.id);

      const result = repo.getSubTask(created.id);
      expect(result).toBeNull();
    });

    it('should not affect other sub-tasks', () => {
      const assignmentId = createAssignmentId();

      const first = repo.upsertSubTask({
        assignmentId,
        title: 'First',
        completed: false,
        order: 0,
      });

      const second = repo.upsertSubTask({
        assignmentId,
        title: 'Second',
        completed: false,
        order: 1,
      });

      repo.deleteSubTask(first.id);

      const list = repo.listSubTasks(assignmentId);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(second.id);
    });
  });

  describe('reorderSubTasks', () => {
    it('should reorder sub-tasks by provided ID order', () => {
      const assignmentId = createAssignmentId();

      const first = repo.upsertSubTask({
        assignmentId,
        title: 'First',
        completed: false,
        order: 0,
      });

      const second = repo.upsertSubTask({
        assignmentId,
        title: 'Second',
        completed: false,
        order: 1,
      });

      const third = repo.upsertSubTask({
        assignmentId,
        title: 'Third',
        completed: false,
        order: 2,
      });

      // Reorder: 3, 1, 2
      repo.reorderSubTasks(assignmentId, [third.id, first.id, second.id]);

      const list = repo.listSubTasks(assignmentId);
      expect(list[0]!.id).toBe(third.id);
      expect(list[0]!.order).toBe(0);
      expect(list[1]!.id).toBe(first.id);
      expect(list[1]!.order).toBe(1);
      expect(list[2]!.id).toBe(second.id);
      expect(list[2]!.order).toBe(2);
    });

    it('should handle empty array', () => {
      const assignmentId = createAssignmentId();

      repo.upsertSubTask({
        assignmentId,
        title: 'Sub-task',
        completed: false,
        order: 0,
      });

      // Should not throw
      expect(() => repo.reorderSubTasks(assignmentId, [])).not.toThrow();
    });
  });

  describe('updateSubTask', () => {
    it('should update completed status', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertSubTask({
        assignmentId,
        title: 'Test',
        completed: false,
        order: 0,
      });

      const updated = repo.updateSubTask(created.id, { completed: true });

      expect(updated?.completed).toBe(true);
      expect(updated?.title).toBe('Test'); // Unchanged
    });

    it('should update title', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertSubTask({
        assignmentId,
        title: 'Original',
        completed: false,
        order: 0,
      });

      const updated = repo.updateSubTask(created.id, { title: 'Updated' });

      expect(updated?.title).toBe('Updated');
    });

    it('should update position (order)', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertSubTask({
        assignmentId,
        title: 'Test',
        completed: false,
        order: 0,
      });

      const updated = repo.updateSubTask(created.id, { position: 5 });

      expect(updated?.order).toBe(5);
    });

    it('should return null for non-existent sub-task', () => {
      const result = repo.updateSubTask('non-existent', { completed: true });
      expect(result).toBeNull();
    });

    it('should update multiple fields at once', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertSubTask({
        assignmentId,
        title: 'Original',
        completed: false,
        order: 0,
      });

      const updated = repo.updateSubTask(created.id, {
        title: 'New Title',
        completed: true,
        position: 3,
      });

      expect(updated?.title).toBe('New Title');
      expect(updated!.completed).toBe(true);
      expect(updated!.order).toBe(3);
    });
  });

  describe('Cascade delete on assignment', () => {
    it('should cascade delete sub-tasks when parent assignment is deleted', async () => {
      const assignmentId = createAssignmentId();

      repo.upsertSubTask({
        assignmentId,
        title: 'Sub-task 1',
        completed: false,
        order: 0,
      });

      repo.upsertSubTask({
        assignmentId,
        title: 'Sub-task 2',
        completed: false,
        order: 1,
      });

      // Delete assignment - should cascade to sub-tasks
      repo.deleteAssignment(assignmentId);

      expect(repo.listSubTasks(assignmentId)).toEqual([]);

      // db:changed events should be emitted for each deleted sub-task
      const deleteEvents = mockState.sendEventToRenderers.mock.calls.filter(
        ([event, payload]) =>
          event === 'db:changed' &&
          (payload as { table: string; action: string }).table === 'sub_tasks' &&
          (payload as { table: string; action: string }).action === 'delete',
      );
      expect(deleteEvents).toHaveLength(2);
    });
  });
});
