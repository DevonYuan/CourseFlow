/**
 * useAssignments Hook Tests
 *
 * Tests for the assignment fetching hook.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, IsoDateTime } from '@backend/shared/types';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAssignments } from '../hooks/useAssignments';

// Mock window.api
type AssignmentsListResult = { ok: true; data: Assignment[] } | { ok: false; error: string; code?: string };

const mockApi = {
  db: {
    assignments: {
      list: vi.fn<() => Promise<AssignmentsListResult>>(),
    },
  },
  onDbChanged: vi.fn(),
};

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true,
  configurable: true,
});

// Track DB change callback
let dbChangedCallback: ((payload: IpcEvents['db:changed']) => void) | null = null;

const mockAssignments: Assignment[] = [
  {
    id: '1' as Assignment['id'],
    title: 'Test Assignment 1',
    description: '',
    courseId: 'course1' as Assignment['courseId'],
    courseName: 'CS101',
    courseColor: '#e8a838',
    dueAt: '2025-12-01T23:59:00.000Z' as IsoDateTime,
    unlockAt: null,
    lockAt: null,
    pointsPossible: 100,
    submissionTypes: ['online_text_entry'],
    workflowState: 'published',
    htmlUrl: 'https://canvas.example.edu/courses/1/assignments/1',
    icalUid: 'uid1',
    priority: 'high',
    status: 'pending',
    source: 'ical',
    sourceUrl: 'https://canvas.example.edu/feeds/calendars/...',
    createdAt: '2025-11-01T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2025-11-01T00:00:00.000Z' as IsoDateTime,
  },
  {
    id: '2' as Assignment['id'],
    title: 'Test Assignment 2',
    description: '',
    courseId: 'course2' as Assignment['courseId'],
    courseName: 'MATH201',
    courseColor: '#38e8a8',
    dueAt: '2025-12-15T23:59:00.000Z' as IsoDateTime,
    unlockAt: null,
    lockAt: null,
    pointsPossible: 50,
    submissionTypes: ['online_upload'],
    workflowState: 'published',
    htmlUrl: 'https://canvas.example.edu/courses/2/assignments/2',
    icalUid: 'uid2',
    priority: 'medium',
    status: 'in_progress',
    source: 'ical',
    sourceUrl: 'https://canvas.example.edu/feeds/calendars/...',
    createdAt: '2025-11-01T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2025-11-01T00:00:00.000Z' as IsoDateTime,
  },
];

describe('useAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChangedCallback = null;

    mockApi.onDbChanged.mockImplementation((cb: (payload: IpcEvents['db:changed']) => void) => {
      dbChangedCallback = cb;
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('initializes with loading state', () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: [] });

    const { result } = renderHook(() => useAssignments());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.assignments).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(false); // Still loading
  });

  it('fetches assignments on mount', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: mockAssignments });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.assignments).toEqual(mockAssignments);
    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(false);
  });

  it('shows empty state when no assignments', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: [] });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.assignments).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(true);
  });

  it('handles fetch error', async () => {
    mockApi.db.assignments.list.mockResolvedValue({
      ok: false,
      error: 'Database connection failed',
      code: 'INTERNAL_ERROR',
    });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.assignments).toEqual([]);
    expect(result.current.error).toBe('An unexpected error occurred. Please try again.');
    expect(result.current.isEmpty).toBe(false); // Has error, not empty
  });

  it('handles network error with user-friendly message', async () => {
    mockApi.db.assignments.list.mockResolvedValue({
      ok: false,
      error: 'Network request failed',
      code: 'NETWORK_ERROR',
    });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error. Check your internet connection.');
  });

  it('refetch triggers new fetch', async () => {
    mockApi.db.assignments.list
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: mockAssignments });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEmpty).toBe(true);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.assignments).toEqual(mockAssignments);
    });
  });

  it('clearError clears error state', async () => {
    mockApi.db.assignments.list.mockResolvedValue({
      ok: false,
      error: 'Failed',
      code: 'INTERNAL_ERROR',
    });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('subscribes to db:changed events and refetches', async () => {
    mockApi.db.assignments.list
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: mockAssignments });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEmpty).toBe(true);

    // Simulate db:changed event
    act(() => {
      dbChangedCallback?.({ table: 'assignments', action: 'upsert', id: '1' });
    });

    await waitFor(() => {
      expect(result.current.assignments).toEqual(mockAssignments);
    });
  });

  it('does not refetch on unrelated db:changed events', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: [] });

    const { result } = renderHook(() => useAssignments());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate db:changed event for different table
    act(() => {
      dbChangedCallback?.({ table: 'sub_tasks', action: 'upsert', id: '1' });
    });

    // Should not call list again
    expect(mockApi.db.assignments.list).toHaveBeenCalledTimes(1);
  });
});