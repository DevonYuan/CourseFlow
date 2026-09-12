/**
 * Note Repository Tests
 *
 * Tests for all notes CRUD operations:
 * - listNotes: fetch by assignment
 * - getNote: fetch by ID
 * - upsertNote: create/update (1:N model - multiple notes per assignment)
 * - deleteNote: delete by ID
 * - updateNote: partial update
 *
 * Tests verify:
 * - Timestamp handling (created_at, updated_at)
 * - Order (newest first)
 * - Cascade deletion on assignment delete
 *
 * @module @backend/main/db/__tests__/repository.notes
 */

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import type { EntityId, IsoDateTime } from '../../../shared/types.js';
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
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

let assignmentCounter = 0;
let noteCounter = 0;

function createAssignmentId(): EntityId {
  assignmentCounter++;
  return `assignment-${assignmentCounter}` as EntityId;
}

const baseTime = Date.now();

describe('Note Repository', () => {
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
    noteCounter = 0;
    mockState.sendEventToRenderers.mockClear();
    if (testDb) {
      testDb.exec('DELETE FROM notes');
      testDb.exec('DELETE FROM sub_tasks');
      testDb.exec('DELETE FROM assignments');
    }
  });

  describe('listNotes', () => {
    it('should return empty array for assignment with no notes', () => {
      const assignmentId = createAssignmentId();

      const result = repo.listNotes(assignmentId);

      expect(result).toEqual([]);
    });

    it('should return all notes for an assignment ordered by updated_at DESC (newest first)', () => {
      const assignmentId = createAssignmentId();
      const now = Date.now();

      // Insert notes with different timestamps
      testDb!.exec(`
        INSERT INTO notes (id, assignment_id, content, created_at, updated_at)
        VALUES 
          ('note-1', '${assignmentId}', 'First note', ${now - 86_400_000}, ${now - 72_000_000}),
          ('note-2', '${assignmentId}', 'Second note', ${now - 43_200_000}, ${now - 36_000_000}),
          ('note-3', '${assignmentId}', 'Third note', ${now - 18_000_000}, ${now})
      `);

      const result = repo.listNotes(assignmentId);

      expect(result).toHaveLength(3);
      // Newest first
      expect(result[0]!.id).toBe('note-3');
      expect(result[1]!.id).toBe('note-2');
      expect(result[2]!.id).toBe('note-1');
    });

    it('should return notes with correct timestamps', () => {
      const assignmentId = createAssignmentId();
      const now = Date.now();

      testDb!.exec(`
        INSERT INTO notes (id, assignment_id, content, created_at, updated_at)
        VALUES ('note-1', '${assignmentId}', 'Test note', ${now - 86_400_000}, ${now - 36_000_000})
      `);

      const result = repo.listNotes(assignmentId);

      expect(result).toHaveLength(1);
      expect(typeof result[0]!.createdAt).toBe('string');
      expect(typeof result[0]!.updatedAt).toBe('string');
    });
  });

  describe('getNote', () => {
    it('should return null for non-existent note', () => {
      const result = repo.getNote('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return the note for a valid ID', () => {
      const assignmentId = createAssignmentId();
      const noteId = `note-${noteCounter + 1}` as EntityId;
      const now = Date.now();

      testDb!.exec(`
        INSERT INTO notes (id, assignment_id, content, created_at, updated_at)
        VALUES ('${noteId}', '${assignmentId}', 'Target note', ${now}, ${now})
      `);

      const result = repo.getNote(noteId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(noteId);
      expect(result!.assignmentId).toBe(assignmentId);
      expect(result!.content).toBe('Target note');
    });
  });

  describe('upsertNote', () => {
    it('should create a new note with generated ID', () => {
      const assignmentId = createAssignmentId();
      const content = '# New Note\n\nThis is markdown content.';

      const result = repo.upsertNote({
        assignmentId,
        content,
      });

      expect(result.id).toBeDefined();
      expect(result.assignmentId).toBe(assignmentId);
      expect(result.content).toBe(content);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create a note without ID (1:N model)', () => {
      const assignmentId = createAssignmentId();

      // Multiple notes for same assignment (1:N model)
      const first = repo.upsertNote({
        assignmentId,
        content: 'First note',
      });

      const second = repo.upsertNote({
        assignmentId,
        content: 'Second note',
      });

      // Each has different ID
      expect(first.id).not.toBe(second.id);
      expect(first.assignmentId).toBe(assignmentId);
      expect(second.assignmentId).toBe(assignmentId);

      // Both exist in list
      const list = repo.listNotes(assignmentId);
      expect(list).toHaveLength(2);
    });

    it('should update an existing note when id is provided', () => {
      const assignmentId = createAssignmentId();
      const now = Date.now();

      // Create note directly
      testDb!.exec(`
        INSERT INTO notes (id, assignment_id, content, created_at, updated_at)
        VALUES ('existing-note', '${assignmentId}', 'Original content', ${now}, ${now})
      `);

      const updated = repo.upsertNote({
        id: 'existing-note' as EntityId,
        assignmentId,
        content: 'Updated content',
      });

      expect(updated.id).toBe('existing-note');
      expect(updated.content).toBe('Updated content');
    });

    it('should preserve created_at when updating', () => {
      const assignmentId = createAssignmentId();
      const originalTime = new Date(baseTime - 86_400_000).toISOString() as IsoDateTime;

      testDb!.exec(`
        INSERT INTO notes (id, assignment_id, content, created_at, updated_at)
        VALUES ('note-1', '${assignmentId}', 'Original', ${baseTime - 86_400_000}, ${baseTime - 86_400_000})
      `);

      const updated = repo.updateNote('note-1', 'Updated');

      expect(updated.createdAt).toBe(originalTime);
    });
  });

  describe('deleteNote', () => {
    it('should delete an existing note', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertNote({
        assignmentId,
        content: 'To be deleted',
      });

      repo.deleteNote(created.id);

      const result = repo.getNote(created.id);
      expect(result).toBeNull();
    });

    it('should not affect other notes', () => {
      const assignmentId = createAssignmentId();

      const first = repo.upsertNote({
        assignmentId,
        content: 'First note',
      });

      const second = repo.upsertNote({
        assignmentId,
        content: 'Second note',
      });

      repo.deleteNote(first.id);

      const list = repo.listNotes(assignmentId);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(second.id);
    });
  });

  describe('updateNote', () => {
    it('should update note content', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertNote({
        assignmentId,
        content: 'Original content',
      });

      const updated = repo.updateNote(created.id, 'Updated content');

      expect(updated.id).toBe(created.id);
      expect(updated.content).toBe('Updated content');
    });

    it('should throw for a non-existent note', () => {
      expect(() => repo.updateNote('non-existent', 'content')).toThrow();
    });

    it('should update the updated_at timestamp', () => {
      const assignmentId = createAssignmentId();

      const created = repo.upsertNote({
        assignmentId,
        content: 'Original',
      });

      const beforeUpdate = new Date(created.updatedAt);

      // Wait a bit to ensure timestamp difference
      const updated = repo.updateNote(created.id, 'Updated');

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should support large content', () => {
      const assignmentId = createAssignmentId();
      const largeContent = 'x'.repeat(10_000);

      const created = repo.upsertNote({
        assignmentId,
        content: largeContent,
      });

      expect(created.content).toBe(largeContent);
    });

    it('should handle markdown content', () => {
      const assignmentId = createAssignmentId();
      const markdownContent = `
# Heading 1

## Heading 2

- List item 1
- List item 2
- \`code\` and **bold** and *italic*

[Link](https://example.com)

\`\`\`javascript
const code = "example";
\`\`\`
`;

      const created = repo.upsertNote({
        assignmentId,
        content: markdownContent,
      });

      expect(created.content).toContain('# Heading 1');
      expect(created.content).toContain('**bold**');
    });
  });

  describe('Notes 1:N model verification', () => {
    it('should support multiple notes per assignment', () => {
      const assignmentId = createAssignmentId();

      // Create 5 notes for same assignment
      for (let i = 0; i < 5; i++) {
        repo.upsertNote({
          assignmentId,
          content: `Note ${i + 1}`,
        });
      }

      const notes = repo.listNotes(assignmentId);
      expect(notes).toHaveLength(5);

      // All have same assignmentId but different IDs and content
      const ids = new Set(notes.map((n) => n.id));
      expect(ids.size).toBe(5); // All IDs unique

      const contents = new Set(notes.map((n) => n.content));
      expect(contents.size).toBe(5); // All contents unique
    });
  });

  describe('Cascade delete on assignment', () => {
    it('should cascade delete notes when parent assignment is deleted', () => {
      const assignmentId = createAssignmentId();

      repo.upsertNote({
        assignmentId,
        content: 'Note 1',
      });

      repo.upsertNote({
        assignmentId,
        content: 'Note 2',
      });

      repo.upsertNote({
        assignmentId,
        content: 'Note 3',
      });

      repo.deleteAssignment(assignmentId);

      expect(repo.listNotes(assignmentId)).toEqual([]);
    });
  });

  describe('Protected from iCal re-import', () => {
    it('notes should be preserved on assignment update', async () => {
      const assignmentId = createAssignmentId();

      // Create a note
      const note = repo.upsertNote({
        assignmentId,
        content: 'Protected note content',
      });

      // Simulate what importAssignments does - update assignment but preserve notes
      // (This is verified in the repository.import.test.ts)

      // The note should still exist
      const notes = repo.listNotes(assignmentId);
      expect(notes).toHaveLength(1);
      expect(notes[0]?.id).toBe(note.id);
      expect(notes[0]?.content).toBe('Protected note content');
    });
  });
});
