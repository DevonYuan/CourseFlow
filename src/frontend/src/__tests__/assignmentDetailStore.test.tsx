/**
 * AssignmentDetailStore Tests
 *
 * Unit tests for the assignment detail Zustand store:
 * fetch, refetch, live updates via db:changed, optimistic actions, cleanup.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, EntityId, IsoDateTime, Note, SubTask } from '@backend/shared/types';
import { act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useAssignmentDetailStore } from '../stores/assignmentDetailStore';

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const mockApi = {
  db: {
    assignments: {
      get: vi.fn<(id: string) => Promise<Result<Assignment | null>>>(),
    },
    subtasks: {
      list: vi.fn<(assignmentId: string) => Promise<Result<SubTask[]>>>(),
    },
    notes: {
      list: vi.fn<(assignmentId: string) => Promise<Result<Note[]>>>(),
    },
  },
  onDbChanged: vi.fn<(cb: (payload: IpcEvents['db:changed']) => void) => () => void>(),
};

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true,
  configurable: true,
});

let dbChangedCallback: ((payload: IpcEvents['db:changed']) => void) | null = null;

const assignmentId = 'assignment-1' as EntityId;

const mockAssignment: Assignment = {
  id: assignmentId,
  title: 'Essay Draft',
  description: '<p>Write an essay</p>',
  courseId: 'course-1' as EntityId,
  courseName: 'CS101',
  courseColor: '#e8a838',
  dueAt: '2026-09-15T23:59:00.000Z' as IsoDateTime,
  unlockAt: null,
  lockAt: null,
  pointsPossible: 100,
  submissionTypes: ['online_text_entry'],
  workflowState: 'published',
  htmlUrl: 'https://canvas.example.edu/courses/1/assignments/1',
  icalUid: 'uid-1',
  priority: 'high',
  status: 'pending',
  source: 'ical',
  sourceUrl: 'https://canvas.example.edu/feeds/calendars/...',
  createdAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
};

const mockSubTasks: SubTask[] = [
  {
    id: 'st-1' as EntityId,
    assignmentId,
    title: 'Outline',
    completed: false,
    order: 0,
    createdAt: '2026-09-02T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-02T00:00:00.000Z' as IsoDateTime,
  },
  {
    id: 'st-2' as EntityId,
    assignmentId,
    title: 'Draft intro',
    completed: false,
    order: 1,
    createdAt: '2026-09-02T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-02T00:00:00.000Z' as IsoDateTime,
  },
];

const mockNotes: Note[] = [
  {
    id: 'note-1' as EntityId,
    assignmentId,
    content: 'Started outlining',
    createdAt: '2026-09-02T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-02T00:00:00.000Z' as IsoDateTime,
  },
];

function resetStore(): void {
  useAssignmentDetailStore.setState({
    assignment: null,
    subTasks: [],
    notes: [],
    isLoading: false,
    error: null,
    notFound: false,
    currentAssignmentId: null,
    _abortController: null,
    _eventUnsubscribe: null,
    _debouncedRefetch: null,
    _subTaskAssignmentMap: new Map(),
    _noteAssignmentMap: new Map(),
  });
}

function subscribeMock(): void {
  mockApi.onDbChanged.mockImplementation((cb) => {
    dbChangedCallback = cb;
    // Realistic unsubscribe: clears the registered callback
    return () => {
      dbChangedCallback = null;
    };
  });
}

describe('assignmentDetailStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    dbChangedCallback = null;
    resetStore();
    subscribeMock();

    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: mockAssignment });
    mockApi.db.subtasks.list.mockResolvedValue({ ok: true, data: mockSubTasks });
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: mockNotes });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches assignment, sub-tasks, and notes in parallel', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
    });

    expect(mockApi.db.assignments.get).toHaveBeenCalledWith(assignmentId);
    expect(mockApi.db.subtasks.list).toHaveBeenCalledWith(assignmentId);
    expect(mockApi.db.notes.list).toHaveBeenCalledWith(assignmentId);

    const state = store.getState();
    expect(state.assignment).toEqual(mockAssignment);
    expect(state.subTasks).toHaveLength(2);
    expect(state.notes).toHaveLength(1);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.notFound).toBe(false);
  });

  it('sets notFound when assignment returns null', async () => {
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: null });

    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
    });

    const state = store.getState();
    expect(state.assignment).toBeNull();
    expect(state.notFound).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets error when assignment fetch fails', async () => {
    mockApi.db.assignments.get.mockResolvedValue({ ok: false, error: 'DB down', code: 'INTERNAL_ERROR' });

    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
    });

    const state = store.getState();
    expect(state.assignment).toBeNull();
    expect(state.error).toBe('DB down');
    expect(state.isLoading).toBe(false);
    expect(state.notFound).toBe(false);
  });

  it('refetch reloads all data for the current assignment', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
    });

    // Simulate a title change in the backend
    const updated = { ...mockAssignment, title: 'Updated title' };
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: updated });
    mockApi.db.subtasks.list.mockResolvedValue({ ok: true, data: [] });
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [] });

    await act(async () => {
      await store.getState().refetch();
    });

    const state = store.getState();
    expect(state.assignment?.title).toBe('Updated title');
    expect(state.subTasks).toHaveLength(0);
    expect(state.notes).toHaveLength(0);
  });

  it('live-updates sub-tasks on db:changed when sub-task belongs to the assignment', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
      store.getState().subscribeToChanges(assignmentId);
    });

    // Simulate toggling a sub-task in another window
    const toggled: SubTask = { ...mockSubTasks[0]!, completed: true };
    mockApi.db.subtasks.list.mockResolvedValue({
      ok: true,
      data: [toggled, mockSubTasks[1]!],
    });

    await act(async () => {
      dbChangedCallback?.({
        table: 'sub_tasks',
        action: 'update',
        id: toggled.id,
      });
      // Advance debounce timer (300ms)
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(store.getState().subTasks[0]?.completed).toBe(true);
  });

  it('live-updates sub-tasks on insert (new sub-task from another window)', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
      store.getState().subscribeToChanges(assignmentId);
    });

    const newSubTask: SubTask = {
      id: 'st-new' as EntityId,
      assignmentId,
      title: 'Cite sources',
      completed: false,
      order: 2,
      createdAt: '2026-09-03T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-09-03T00:00:00.000Z' as IsoDateTime,
    };
    mockApi.db.subtasks.list.mockResolvedValue({
      ok: true,
      data: [...mockSubTasks, newSubTask],
    });

    await act(async () => {
      dbChangedCallback?.({
        table: 'sub_tasks',
        action: 'insert',
        id: newSubTask.id,
      });
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(store.getState().subTasks).toHaveLength(3);
  });

  it('does not refetch sub-tasks when event is for another assignment', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
      store.getState().subscribeToChanges(assignmentId);
    });

    // Event for a sub-task belonging to a DIFFERENT assignment
    await act(async () => {
      dbChangedCallback?.({
        table: 'sub_tasks',
        action: 'update',
        id: 'st-other' as EntityId,
      });
      await vi.advanceTimersByTimeAsync(350);
    });

    // No refetch should have happened (2 = initial fetch only)
    expect(mockApi.db.subtasks.list).toHaveBeenCalledTimes(1);
  });

  it('live-updates notes on db:changed', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
      store.getState().subscribeToChanges(assignmentId);
    });

    const updatedNote: Note = {
      ...mockNotes[0]!,
      content: 'Outline done, moving to draft',
      updatedAt: '2026-09-04T00:00:00.000Z' as IsoDateTime,
    };
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [updatedNote] });

    await act(async () => {
      dbChangedCallback?.({
        table: 'notes',
        action: 'update',
        id: updatedNote.id,
      });
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(store.getState().notes[0]?.content).toBe('Outline done, moving to draft');
  });

  it('marks not-found when assignment is deleted via db:changed', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
      store.getState().subscribeToChanges(assignmentId);
    });

    await act(async () => {
      dbChangedCallback?.({
        table: 'assignments',
        action: 'delete',
        id: assignmentId,
      });
    });

    const state = store.getState();
    expect(state.notFound).toBe(true);
    expect(state.assignment).toBeNull();
  });

  it('unsubscribes cleanly and stops reacting to events', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
      store.getState().subscribeToChanges(assignmentId);
      store.getState().unsubscribe();
    });

    const updated: Assignment = { ...mockAssignment, title: 'Should not appear' };
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: updated });

    await act(async () => {
      dbChangedCallback?.({
        table: 'assignments',
        action: 'update',
        id: assignmentId,
      });
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(store.getState().assignment?.title).toBe('Essay Draft');
    expect(mockApi.db.assignments.get).toHaveBeenCalledTimes(1); // initial fetch only
  });

  it('optimistically updates sub-tasks and notes', async () => {
    const store = useAssignmentDetailStore;
    await act(async () => {
      await store.getState().fetch(assignmentId);
    });

    const newSubTask: SubTask = {
      id: 'st-opt' as EntityId,
      assignmentId,
      title: 'Proofread',
      completed: false,
      order: 2,
      createdAt: '2026-09-05T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-09-05T00:00:00.000Z' as IsoDateTime,
    };
    const newNote: Note = {
      id: 'note-opt' as EntityId,
      assignmentId,
      content: 'Nearly done',
      createdAt: '2026-09-05T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-09-05T00:00:00.000Z' as IsoDateTime,
    };

    await act(async () => {
      store.getState().addSubTask(newSubTask);
      store.getState().addNote(newNote);
      store.getState().updateSubTask({ ...newSubTask, completed: true });
      store.getState().removeSubTask(mockSubTasks[0]!.id);
      store.getState().updateNote({ ...newNote, content: 'Done!' });
    });

    const state = store.getState();
    expect(state.subTasks).toHaveLength(2); // removed one from original
    expect(state.subTasks.find((st) => st.id === newSubTask.id)?.completed).toBe(true);
    expect(state.notes.find((n) => n.id === newNote.id)?.content).toBe('Done!');
  });
});