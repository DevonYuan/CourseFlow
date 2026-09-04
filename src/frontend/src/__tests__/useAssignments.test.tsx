/**
 * useAssignments Hook Tests
 *
 * Tests for the assignment fetching hook using Zustand store.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, IsoDateTime } from '@backend/shared/types';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ToastProvider } from '../context/ToastContext';
import { useAssignments } from '../hooks/useAssignments';
import { useAssignmentsStore } from '../store/assignmentsStore';

// Mock window.api
type AssignmentsListResult = { ok: true; data: Assignment[] } | { ok: false; error: string; code?: string };
type PriorityListResult = { ok: true; data: import('@backend/shared/types').PriorityOrder[] } | { ok: false; error: string; code?: string };

const mockApi = {
  db: {
    assignments: {
      list: vi.fn<() => Promise<AssignmentsListResult>>(),
    },
    priority: {
      list: vi.fn<() => Promise<PriorityListResult>>(),
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

// Helper to reset Zustand store to initial state
function resetStore() {
  useAssignmentsStore.setState({
    assignments: [],
    isLoading: true,
    error: null,
    isEmpty: true,
  });
}

// Wrapper component to provide ToastContext
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('useAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChangedCallback = null;
    resetStore();

    mockApi.onDbChanged.mockImplementation((cb: (payload: IpcEvents['db:changed']) => void) => {
      dbChangedCallback = cb;
      return vi.fn();
    });

    // Default mock for priority.list - returns empty priority order
    mockApi.db.priority.list.mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    vi.resetAllMocks();
    resetStore();
  });

  it('returns correct initial state shape', () => {
    const { result } = renderHook(() => useAssignments(), { wrapper });

    expect(result.current).toHaveProperty('assignments');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('isEmpty');
    expect(result.current).toHaveProperty('refetch');
    expect(result.current).toHaveProperty('clearError');
    expect(Array.isArray(result.current.assignments)).toBe(true);
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(typeof result.current.refetch).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('fetches assignments when fetchAssignments is called', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: mockAssignments });

    const { result } = renderHook(() => useAssignments(), { wrapper });

    // Trigger fetch via store
    await act(async () => {
      await useAssignmentsStore.getState().fetchAssignments();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.assignments).toEqual(mockAssignments);
    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(false);
  });

  it('shows empty state when no assignments', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: [] });

    const { result } = renderHook(() => useAssignments(), { wrapper });

    await act(async () => {
      await useAssignmentsStore.getState().fetchAssignments();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

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

    const { result } = renderHook(() => useAssignments(), { wrapper });

    await act(async () => {
      await useAssignmentsStore.getState().fetchAssignments();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

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

    const { result } = renderHook(() => useAssignments(), { wrapper });

    await act(async () => {
      await useAssignmentsStore.getState().fetchAssignments();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error. Check your internet connection.');
  });

  it('refetch triggers new fetch', async () => {
    mockApi.db.assignments.list
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: mockAssignments });

    const { result } = renderHook(() => useAssignments(), { wrapper });

    await act(async () => {
      await useAssignmentsStore.getState().fetchAssignments();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEmpty).toBe(true);

    await act(async () => {
      await result.current.refetch();
      await new Promise((resolve) => setTimeout(resolve, 0));
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

    const { result } = renderHook(() => useAssignments(), { wrapper });

    await act(async () => {
      await useAssignmentsStore.getState().fetchAssignments();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});