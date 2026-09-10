/**
 * AssignmentDetailPage Tests
 *
 * Component tests for the detail page states:
 * loading skeleton, error + retry, not-found, and successful render.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, EntityId, IsoDateTime, Note, SubTask } from '@backend/shared/types';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { AssignmentDetailPage } from '../pages/AssignmentDetailPage';
import { useAssignmentDetailStore } from '../stores/assignmentDetailStore';
import { ToastProvider } from '../context/ToastContext';

expect.extend(matchers);

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

function renderDetailPage(path = `/assignments/${assignmentId}`): void {
  render(
    <ErrorBoundary>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </ErrorBoundary>,
  );
}

describe('AssignmentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();

    mockApi.onDbChanged.mockReturnValue(vi.fn());

    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: mockAssignment });
    mockApi.db.subtasks.list.mockResolvedValue({ ok: true, data: [] });
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders assignment details on success', async () => {
    renderDetailPage();

    // Skeleton during load
    expect(screen.getByRole('status', { name: 'Loading assignment details' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Essay Draft' })).toBeInTheDocument();
    });

    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Write an essay')).toBeInTheDocument();
  });

  it('shows not-found state for an invalid assignment ID', async () => {
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: null });

    renderDetailPage('/assignments/invalid-uuid');

    await waitFor(() => {
      expect(screen.getByText('Assignment not found')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /back to assignments/i })).toBeInTheDocument();
  });

  it('shows error state with retry when the fetch fails', async () => {
    mockApi.db.assignments.get.mockResolvedValue({
      ok: false,
      error: 'Database unreachable',
      code: 'INTERNAL_ERROR',
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Database unreachable')).toBeInTheDocument();
    });

    // Retry button present
    const retryButton = screen.getByRole('button', { name: 'Try again' });
    expect(retryButton).toBeInTheDocument();

    // Fix the backend and click retry → success state
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: mockAssignment });
    retryButton.click();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Essay Draft' })).toBeInTheDocument();
    });
  });
});