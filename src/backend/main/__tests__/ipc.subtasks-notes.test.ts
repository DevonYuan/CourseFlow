/**
 * Integration tests for Sub-task and Note IPC handlers.
 *
 * Verifies the 7 Phase 3 channels:
 * - db:subtasks:list / upsert / delete / toggle
 * - db:notes:list / upsert / delete
 *
 * Each handler must return a typed IpcResult and emit the correct `db:changed`
 * event on mutations.
 *
 * @module @backend/main/__tests__/ipc.subtasks-notes
 */

import { ipcMain } from 'electron';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

// Mock the ical utilities (imported by ipc-handlers, not exercised here)
vi.mock('../ical/index.js', () => ({
  fetchICalFeed: vi.fn(),
  parseICalFeed: vi.fn(),
  mapICalToAssignments: vi.fn(),
  NetworkError: class NetworkError extends Error {},
  HttpError: class HttpError extends Error {},
  TimeoutError: class TimeoutError extends Error {},
  ICalParseError: class ICalParseError extends Error {},
}));

// Mock the repository
vi.mock('../db/repository.js', () => ({
  repo: {
    listSubTasks: vi.fn(),
    upsertSubTask: vi.fn(),
    deleteSubTask: vi.fn(),
    updateSubTask: vi.fn(),
    listNotes: vi.fn(),
    upsertNote: vi.fn(),
    deleteNote: vi.fn(),
  },
}));

// Mock events
vi.mock('../events.js', () => ({
  sendEventToRenderers: vi.fn(),
}));

// Import mocked modules
import type { IpcResult } from '../../shared/ipc.js';
import type { Note, SubTask } from '../../shared/types.js';
import { repo } from '../db/repository.js';
import { sendEventToRenderers } from '../events.js';
import { registerIpcHandlers } from '../ipc-handlers.js';

function makeSubTask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: 'sub-1' as SubTask['id'],
    assignmentId: 'assignment-1' as SubTask['assignmentId'],
    title: 'Sub-task',
    completed: false,
    order: 0,
    createdAt: '2025-01-01T00:00:00.000Z' as SubTask['createdAt'],
    updatedAt: '2025-01-01T00:00:00.000Z' as SubTask['updatedAt'],
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1' as Note['id'],
    assignmentId: 'assignment-1' as Note['assignmentId'],
    content: 'Note content',
    createdAt: '2025-01-01T00:00:00.000Z' as Note['createdAt'],
    updatedAt: '2025-01-01T00:00:00.000Z' as Note['updatedAt'],
    ...overrides,
  };
}

type IpcHandler = (event: unknown, request: unknown) => unknown;

describe('Sub-task & Note IPC Handlers', () => {
  let registeredHandlers: Map<string, IpcHandler>;

  beforeEach(async () => {
    vi.resetAllMocks();

    registeredHandlers = new Map();
    const handleMock = vi.mocked(ipcMain.handle);
    handleMock.mockImplementation((channel: string, handler: unknown) => {
      registeredHandlers.set(channel, handler as IpcHandler);
    });

    // Import the module to register handlers
    await import('../ipc-handlers.js');
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const invoke = async <T>(channel: string, request: unknown): Promise<IpcResult<T>> => {
    const handler = registeredHandlers.get(channel);
    if (!handler) {
      throw new Error(`Handler for channel ${channel} not registered`);
    }
    return handler(null, request) as Promise<IpcResult<T>>;
  };

  // ── Sub-tasks ──────────────────────────────────────────────────────────

  describe('db:subtasks:list', () => {
    it('returns the sub-tasks for an assignment', async () => {
      const subTasks = [makeSubTask(), makeSubTask({ id: 'sub-2' as SubTask['id'] })];
      vi.mocked(repo.listSubTasks).mockReturnValue(subTasks);

      const result = await invoke<SubTask[]>('db:subtasks:list', 'assignment-1');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(subTasks);
      expect(repo.listSubTasks).toHaveBeenCalledWith('assignment-1');
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.listSubTasks).mockImplementation(() => {
        throw new Error('boom');
      });

      const result = await invoke<SubTask[]>('db:subtasks:list', 'assignment-1');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('boom');
    });
  });

  describe('db:subtasks:upsert', () => {
    it('creates a sub-task and emits an insert event', async () => {
      const created = makeSubTask();
      vi.mocked(repo.upsertSubTask).mockReturnValue(created);

      const result = await invoke<SubTask>('db:subtasks:upsert', {
        assignmentId: 'assignment-1',
        title: 'Sub-task',
        completed: false,
        order: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(created);
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'sub_tasks',
        action: 'insert',
        id: 'sub-1',
      });
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.upsertSubTask).mockImplementation(() => {
        throw new Error('cannot insert');
      });

      const result = await invoke<SubTask>('db:subtasks:upsert', {
        assignmentId: 'assignment-1',
        title: 'Sub-task',
        completed: false,
        order: 0,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('cannot insert');
      expect(sendEventToRenderers).not.toHaveBeenCalled();
    });
  });

  describe('db:subtasks:delete', () => {
    it('deletes a sub-task and emits a delete event', async () => {
      const result = await invoke<void>('db:subtasks:delete', 'sub-1');

      expect(result.ok).toBe(true);
      expect(repo.deleteSubTask).toHaveBeenCalledWith('sub-1');
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'sub_tasks',
        action: 'delete',
        id: 'sub-1',
      });
    });
  });

  describe('db:subtasks:toggle', () => {
    it('toggles completion and emits an update event', async () => {
      const updated = makeSubTask({ completed: true });
      vi.mocked(repo.updateSubTask).mockReturnValue(updated);

      const result = await invoke<SubTask>('db:subtasks:toggle', {
        id: 'sub-1',
        completed: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.completed).toBe(true);
      expect(repo.updateSubTask).toHaveBeenCalledWith('sub-1', { completed: true });
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'sub_tasks',
        action: 'update',
        id: 'sub-1',
      });
    });

    it('returns NOT_FOUND when the sub-task does not exist', async () => {
      vi.mocked(repo.updateSubTask).mockReturnValue(null);

      const result = await invoke<SubTask>('db:subtasks:toggle', {
        id: 'missing',
        completed: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('NOT_FOUND');
      expect(sendEventToRenderers).not.toHaveBeenCalled();
    });
  });

  // ── Notes ──────────────────────────────────────────────────────────────

  describe('db:notes:list', () => {
    it('returns the notes for an assignment', async () => {
      const notes = [makeNote()];
      vi.mocked(repo.listNotes).mockReturnValue(notes);

      const result = await invoke<Note[]>('db:notes:list', 'assignment-1');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(notes);
      expect(repo.listNotes).toHaveBeenCalledWith('assignment-1');
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.listNotes).mockImplementation(() => {
        throw new Error('db down');
      });

      const result = await invoke<Note[]>('db:notes:list', 'assignment-1');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('db down');
    });
  });

  describe('db:notes:upsert', () => {
    it('creates a note and emits an insert event when no id is provided', async () => {
      const created = makeNote();
      vi.mocked(repo.upsertNote).mockReturnValue(created);

      const result = await invoke<Note>('db:notes:upsert', {
        assignmentId: 'assignment-1',
        content: 'Note content',
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(created);
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'notes',
        action: 'insert',
        id: 'note-1',
      });
    });

    it('emits an update event when an id is provided', async () => {
      const updated = makeNote({ content: 'Updated' });
      vi.mocked(repo.upsertNote).mockReturnValue(updated);

      const result = await invoke<Note>('db:notes:upsert', {
        id: 'note-1',
        assignmentId: 'assignment-1',
        content: 'Updated',
      });

      expect(result.ok).toBe(true);
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'notes',
        action: 'update',
        id: 'note-1',
      });
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.upsertNote).mockImplementation(() => {
        throw new Error('note failed');
      });

      const result = await invoke<Note>('db:notes:upsert', {
        assignmentId: 'assignment-1',
        content: 'Note content',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('note failed');
      expect(sendEventToRenderers).not.toHaveBeenCalled();
    });
  });

  describe('db:notes:delete', () => {
    it('deletes a note and emits a delete event', async () => {
      const result = await invoke<void>('db:notes:delete', 'note-1');

      expect(result.ok).toBe(true);
      expect(repo.deleteNote).toHaveBeenCalledWith('note-1');
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'notes',
        action: 'delete',
        id: 'note-1',
      });
    });
  });
});
