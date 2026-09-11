/**
 * useNotes Hook Tests
 *
 * Covers optimistic add/update/delete with success, rollback on IPC failure,
 * rollback on thrown errors, and the isSaving flag.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { EntityId, IsoDateTime, Note } from '@backend/shared/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotes } from '../hooks/useNotes';
import { useAssignmentDetailStore } from '../stores/assignmentDetailStore';

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const mockApi = {
  db: {
    assignments: { get: vi.fn() },
    subtasks: { list: vi.fn() },
    notes: {
      list: vi.fn<(assignmentId: string) => Promise<Result<Note[]>>>(),
      upsert:
        vi.fn<
          (input: { id?: string; assignmentId: string; content: string }) => Promise<Result<Note>>
        >(),
      delete: vi.fn<(id: string) => Promise<Result<void>>>(),
    },
  },
  onDbChanged: vi.fn<(cb: (payload: IpcEvents['db:changed']) => void) => () => void>(),
};

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true,
  configurable: true,
});

const assignmentId = 'assignment-1' as EntityId;
const now = '2026-09-05T12:00:00.000Z' as IsoDateTime;

const note1: Note = {
  id: 'note-1' as EntityId,
  assignmentId,
  content: 'First note',
  createdAt: now,
  updatedAt: now,
};

function resetStore(notes: Note[] = [], currentAssignmentId: EntityId | null = assignmentId): void {
  useAssignmentDetailStore.setState({
    assignment: null,
    subTasks: [],
    notes,
    isLoading: false,
    error: null,
    notFound: false,
    currentAssignmentId,
    _abortController: null,
    _eventUnsubscribe: null,
    _debouncedRefetch: null,
    _subTaskAssignmentMap: new Map(),
    _noteAssignmentMap: new Map(),
  });
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (e: unknown) => void;
} {
  let resolveFn: ((value: T) => void) | null = null;
  let rejectFn: ((e: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return {
    promise,
    resolve: (value: T) => resolveFn?.(value),
    reject: (e: unknown) => rejectFn?.(e),
  };
}

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.onDbChanged.mockReturnValue(vi.fn());
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: null });
    mockApi.db.subtasks.list.mockResolvedValue({ ok: true, data: [] });
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    resetStore();
  });

  it('optimistically adds a note and replaces it with the persisted note', async () => {
    resetStore([]);
    const d = deferred<Result<Note>>();
    mockApi.db.notes.upsert.mockReturnValue(d.promise);

    const { result } = renderHook(() => useNotes(assignmentId));

    let addPromise: Promise<Result<Note>> | undefined;
    act(() => {
      addPromise = result.current.addNote(assignmentId, '  Hello world  ');
    });

    // Optimistic entry appears immediately, trimmed
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    expect(result.current.notes[0]?.content).toBe('Hello world');
    expect(result.current.notes[0]?.id).toMatch(/^temp-note-/);
    expect(result.current.isSaving).toBe(true);

    const persisted: Note = {
      id: 'note-real' as EntityId,
      assignmentId,
      content: 'Hello world',
      createdAt: now,
      updatedAt: now,
    };
    await act(async () => {
      d.resolve({ ok: true, data: persisted });
      await addPromise;
    });

    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0]?.id).toBe('note-real');
    expect(result.current.isSaving).toBe(false);
    expect(mockApi.db.notes.upsert).toHaveBeenCalledWith({
      assignmentId,
      content: 'Hello world',
    });
  });

  it('rolls back an optimistic add when the IPC returns an error', async () => {
    resetStore([]);
    mockApi.db.notes.upsert.mockResolvedValue({ ok: false, error: 'Database is locked' });

    const { result } = renderHook(() => useNotes(assignmentId));

    let res: Result<Note> | undefined;
    await act(async () => {
      res = await result.current.addNote(assignmentId, 'will fail');
    });

    expect(res?.ok).toBe(false);
    expect(result.current.notes).toHaveLength(0);
    expect(result.current.isSaving).toBe(false);
  });

  it('rolls back an optimistic add when the IPC throws', async () => {
    resetStore([]);
    mockApi.db.notes.upsert.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useNotes(assignmentId));

    let res: Result<Note> | undefined;
    await act(async () => {
      res = await result.current.addNote(assignmentId, 'will throw');
    });

    expect(res?.ok).toBe(false);
    expect(result.current.notes).toHaveLength(0);
  });

  it('optimistically updates a note and persists the new content', async () => {
    resetStore([note1]);
    const d = deferred<Result<Note>>();
    mockApi.db.notes.upsert.mockReturnValue(d.promise);

    const { result } = renderHook(() => useNotes(assignmentId));

    let updatePromise: Promise<Result<Note>> | undefined;
    act(() => {
      updatePromise = result.current.updateNote(note1.id, 'Updated content');
    });

    await waitFor(() => expect(result.current.notes[0]?.content).toBe('Updated content'));

    const persisted: Note = {
      ...note1,
      content: 'Updated content',
      updatedAt: '2026-09-05T13:00:00.000Z' as IsoDateTime,
    };
    await act(async () => {
      d.resolve({ ok: true, data: persisted });
      await updatePromise;
    });

    expect(result.current.notes[0]?.content).toBe('Updated content');
    expect(result.current.notes[0]?.updatedAt).toBe('2026-09-05T13:00:00.000Z');
    expect(mockApi.db.notes.upsert).toHaveBeenCalledWith({
      id: 'note-1',
      assignmentId,
      content: 'Updated content',
    });
  });

  it('rolls back an optimistic update on failure', async () => {
    resetStore([note1]);
    mockApi.db.notes.upsert.mockResolvedValue({ ok: false, error: 'Failed' });

    const { result } = renderHook(() => useNotes(assignmentId));

    let res: Result<Note> | undefined;
    await act(async () => {
      res = await result.current.updateNote(note1.id, 'new content');
    });

    expect(res?.ok).toBe(false);
    expect(result.current.notes[0]?.content).toBe('First note');
  });

  it('returns an error when updating a note that is not in the store', async () => {
    resetStore([]);
    const { result } = renderHook(() => useNotes(assignmentId));

    let res: Result<Note> | undefined;
    await act(async () => {
      res = await result.current.updateNote('missing' as EntityId, 'content');
    });

    expect(res?.ok).toBe(false);
    expect(mockApi.db.notes.upsert).not.toHaveBeenCalled();
  });

  it('deletes a note optimistically on success', async () => {
    resetStore([note1]);
    mockApi.db.notes.delete.mockResolvedValue({ ok: true, data: undefined });

    const { result } = renderHook(() => useNotes(assignmentId));

    let res: Result<void> | undefined;
    await act(async () => {
      res = await result.current.deleteNote(note1.id);
    });

    expect(res?.ok).toBe(true);
    expect(result.current.notes).toHaveLength(0);
    expect(mockApi.db.notes.delete).toHaveBeenCalledWith('note-1');
  });

  it('restores a note when delete fails', async () => {
    resetStore([note1]);
    mockApi.db.notes.delete.mockResolvedValue({ ok: false, error: 'Nope' });

    const { result } = renderHook(() => useNotes(assignmentId));

    let res: Result<void> | undefined;
    await act(async () => {
      res = await result.current.deleteNote(note1.id);
    });

    expect(res?.ok).toBe(false);
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0]?.id).toBe('note-1');
  });

  it('restores a note when delete throws', async () => {
    resetStore([note1]);
    mockApi.db.notes.delete.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useNotes(assignmentId));

    let res: Result<void> | undefined;
    await act(async () => {
      res = await result.current.deleteNote(note1.id);
    });

    expect(res?.ok).toBe(false);
    expect(result.current.notes).toHaveLength(1);
  });

  it('fetchNotes performs a lightweight refetch when the assignment is already loaded', async () => {
    resetStore([note1], assignmentId);
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [note1] });

    const { result } = renderHook(() => useNotes(assignmentId));
    await act(async () => {
      await result.current.fetchNotes(assignmentId);
    });

    expect(mockApi.db.notes.list).toHaveBeenCalledWith(assignmentId);
    // Full detail fetch is not triggered when the store already has this assignment
    expect(mockApi.db.assignments.get).not.toHaveBeenCalled();
  });
});
