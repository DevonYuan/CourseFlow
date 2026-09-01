/**
 * AssignmentList Tests
 *
 * Tests for the main assignment list component integrating all states.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { AssignmentList } from '../components/AssignmentList';
import type { Assignment, IsoDateTime } from '@backend/shared/types';
import type { IpcEvents } from '@backend/shared/ipc';
import { useAssignmentsStore } from '../store/assignmentsStore';
import { ToastProvider } from '../context/ToastContext';

// Mock window.api
const mockApi = {
  db: {
    assignments: {
      list: vi.fn(),
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
    id: '1' as any,
    title: 'Test Assignment 1',
    description: '',
    courseId: 'course1' as any,
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
];

const mockOnOpenSettings = vi.fn();
const mockOnAssignmentClick = vi.fn();

// Helper to reset Zustand store to initial state
function resetStore() {
  useAssignmentsStore.setState({
    assignments: [],
    isLoading: true,
    error: null,
    isEmpty: true,
  });
}

describe('AssignmentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    // Reset mock implementations to avoid leakage between tests
    mockApi.db.assignments.list.mockReset();
    dbChangedCallback = null;

    mockApi.onDbChanged.mockImplementation((cb) => {
      dbChangedCallback = cb;
      return vi.fn();
    });

    mockOnOpenSettings.mockClear();
    mockOnAssignmentClick.mockClear();
  });

  it('shows skeleton while loading', () => {
    mockApi.db.assignments.list.mockImplementation(() => new Promise(() => {}));

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading assignments');
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(4);
  });

  it('shows empty state when no assignments and not loading', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: [] });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No assignments yet')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
  });

  it('shows assignments when data is available', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: mockAssignments });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
    });

    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    // Due date format: "Mon, Dec 1 • 03:59 PM" (weekday, month, day • time)
    expect(screen.getByText('Mon, Dec 1 • 03:59 PM')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockApi.db.assignments.list.mockResolvedValue({
      ok: false,
      error: 'Database error',
      code: 'INTERNAL_ERROR',
    });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls onOpenSettings when empty state CTA is clicked', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: [] });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));

    expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('calls onAssignmentClick when assignment row is clicked', async () => {
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: mockAssignments });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test Assignment 1'));

    expect(mockOnAssignmentClick).toHaveBeenCalledTimes(1);
    expect(mockOnAssignmentClick).toHaveBeenCalledWith(mockAssignments[0]);
  });

  it('retries fetch when retry button is clicked', async () => {
    mockApi.db.assignments.list
      .mockResolvedValueOnce({
        ok: false,
        error: 'Failed',
        code: 'INTERNAL_ERROR',
      })
      .mockResolvedValueOnce({ ok: true, data: mockAssignments });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
    });

    expect(mockApi.db.assignments.list).toHaveBeenCalledTimes(2);
  });

  it('dismisses error when dismiss button is clicked and shows empty state if no assignments', async () => {
    mockApi.db.assignments.list
      .mockResolvedValueOnce({
        ok: false,
        error: 'Failed',
        code: 'INTERNAL_ERROR',
      })
      .mockResolvedValueOnce({ ok: true, data: [] });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    // After dismiss, error is cleared but no assignments exist, so empty state shows
    await waitFor(() => {
      expect(screen.getByText('No assignments yet')).toBeInTheDocument();
    });
  });

  it('shows overdue badge for overdue assignments', async () => {
    const baseAssignment = mockAssignments[0]!;
    const overdueAssignment: Assignment = {
      id: baseAssignment.id,
      title: baseAssignment.title,
      description: baseAssignment.description,
      courseId: baseAssignment.courseId,
      courseName: baseAssignment.courseName,
      courseColor: baseAssignment.courseColor,
      dueAt: '2020-01-01T23:59:00.000Z' as IsoDateTime, // Past date
      unlockAt: baseAssignment.unlockAt,
      lockAt: baseAssignment.lockAt,
      pointsPossible: baseAssignment.pointsPossible,
      submissionTypes: baseAssignment.submissionTypes,
      workflowState: baseAssignment.workflowState,
      htmlUrl: baseAssignment.htmlUrl,
      icalUid: baseAssignment.icalUid,
      priority: baseAssignment.priority,
      status: baseAssignment.status,
      source: baseAssignment.source,
      sourceUrl: baseAssignment.sourceUrl,
      createdAt: baseAssignment.createdAt,
      updatedAt: baseAssignment.updatedAt,
    };
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: [overdueAssignment] });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    // Wait for assignment to appear first
    await waitFor(() => {
      expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Then check for overdue badge
    expect(screen.getByLabelText('Overdue')).toBeInTheDocument();
  });

  it('renders multiple assignments', async () => {
    const assignments = [
      mockAssignments[0],
      { ...mockAssignments[0], id: '2' as any, title: 'Assignment 2', courseName: 'MATH201' },
    ];
    mockApi.db.assignments.list.mockResolvedValue({ ok: true, data: assignments });

    render(
      <ToastProvider>
        <AssignmentList onOpenSettings={mockOnOpenSettings} onAssignmentClick={mockOnAssignmentClick} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Assignment 2')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
    expect(screen.getByText('MATH201')).toBeInTheDocument();
  });
});