/**
 * useAssignmentDetail Hook Tests
 *
 * Tests the detail data loading hook: fetches assignment + sub-tasks + notes
 * on mount, handles loading/error/not-found states, and cleans up on unmount.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, EntityId, IsoDateTime, Note, SubTask } from '@backend/shared/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useAssignmentDetail } from '../hooks/useAssignmentDetail';
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

const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <React.StrictMode>{children}</React.StrictMode>
);

/**
 * Creates a manually-resolvable promise, useful for controlling async IPC
 * timing in tests.
 */
function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolveFn: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolveFn = resolve;
  });
  return {
    promise,
    resolve: (value: T) => {
      if (resolveFn) resolveFn(value);
    },
  };
}

describe('useAssignmentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();

    mockApi.onDbChanged.mockReturnValue(vi.fn());

    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: mockAssignment });
    mockApi.db.subtasks.list.mockResolvedValue({ ok: true, data: mockSubTasks });
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: mockNotes });
  });

  it('loads assignment, sub-tasks, and notes', async () => {
    const { result } = renderHook(() => useAssignmentDetail(assignmentId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assignment?.title).toBe('Essay Draft');
    expect(result.current.subTasks).toHaveLength(1);
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.notFound).toBe(false);
  });

  it('exposes loading state while fetches are pending', async () => {
    const deferred = createDeferred<Result<Assignment | null>>();
    mockApi.db.assignments.get.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useAssignmentDetail(assignmentId), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.assignment).toBeNull();

    await act(async () => {
      deferred.resolve({ ok: true, data: mockAssignment });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.assignment?.id).toBe(assignmentId);
  });

  it('sets notFound when assignment does not exist', async () => {
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: null });

    const { result } = renderHook(() => useAssignmentDetail('missing-id'), { wrapper });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.assignment).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error when fetch fails and refetch retries', async () => {
    mockApi.db.assignments.get.mockResolvedValue({
      ok: false,
      error: 'Database unreachable',
      code: 'INTERNAL_ERROR',
    });

    const { result } = renderHook(() => useAssignmentDetail(assignmentId), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('Database unreachable'));

    // Fix the backend and retry
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: mockAssignment });
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.assignment?.title).toBe('Essay Draft');
  });

  it('refetches when assignment ID changes (no stale data)', async () => {
    const secondAssignment: Assignment = {
      ...mockAssignment,
      id: 'assignment-2' as EntityId,
      title: 'Homework 5',
    };
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: mockAssignment });

    const { result, rerender } = renderHook(({ id }: { id: string }) => useAssignmentDetail(id), {
      initialProps: { id: assignmentId },
      wrapper,
    });

    await waitFor(() => expect(result.current.assignment?.title).toBe('Essay Draft'));

    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: secondAssignment });
    mockApi.db.subtasks.list.mockResolvedValue({ ok: true, data: [] });
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [] });

    rerender({ id: 'assignment-2' as EntityId });

    await waitFor(() => expect(result.current.assignment?.title).toBe('Homework 5'));
    expect(result.current.subTasks).toHaveLength(0);
  });

  it('cleans up on unmount (no stray listeners or state bleed)', async () => {
    const unsubscribe = vi.fn();
    mockApi.onDbChanged.mockImplementation(() => unsubscribe);

    const { result, unmount } = renderHook(() => useAssignmentDetail(assignmentId), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    // unsubscribe + reset should have been called; no errors thrown
    expect(unsubscribe).toHaveBeenCalled();
    const state = useAssignmentDetailStore.getState();
    expect(state.assignment).toBeNull();
    expect(state._eventUnsubscribe).toBeNull();
    expect(state.currentAssignmentId).toBeNull();
  });
});
