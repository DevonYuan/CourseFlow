/**
 * AssignmentList — Main Assignment List Component
 *
 * Displays assignments with loading skeleton, empty state, and error handling.
 * Integrates useAssignments hook for data fetching and state management.
 *
 * @module @frontend/components/AssignmentList
 */

import { AssignmentListSkeleton } from './AssignmentListSkeleton';
import { EmptyState } from './EmptyState';
import { useAssignments } from '../hooks/useAssignments';
import type { Assignment } from '@backend/shared/types';
import './AssignmentList.css';

interface AssignmentListProps {
  /** Callback fired when user clicks "Open Settings" from empty state */
  onOpenSettings: () => void;
  /** Optional callback when an assignment is clicked */
  onAssignmentClick?: (assignment: Assignment) => void;
}

/**
 * Main assignment list component with full state handling:
 * - Skeleton loaders while fetching
 * - Empty state with CTA to Settings
 * - Error state with retry button
 * - Assignment rows when data is available
 */
export function AssignmentList({ onOpenSettings, onAssignmentClick }: AssignmentListProps): JSX.Element {
  const { assignments, isLoading, error, isEmpty, refetch, clearError } = useAssignments();

  // Show skeleton while loading
  if (isLoading) {
    return <AssignmentListSkeleton count={4} />;
  }

  // Show empty state when no assignments and no error
  if (isEmpty) {
    return <EmptyState onOpenSettings={onOpenSettings} />;
  }

  // Show error state when fetch failed
  if (error) {
    return (
      <div className="assignment-list__error" role="alert" aria-live="assertive">
        <div className="error-banner">
          <div className="error-banner__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="error-banner__content">
            <p className="error-banner__message">{error}</p>
            <div className="error-banner__actions">
              <button
                className="error-banner__retry"
                onClick={() => {
                  clearError();
                  void refetch();
                }}
                type="button"
              >
                Retry
              </button>
              <button
                className="error-banner__dismiss"
                onClick={() => {
                  clearError();
                }}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
        {assignments.length > 0 && (
          <div className="assignment-list__rows" role="list" aria-label="Assignments">
            {assignments.map((assignment) => (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                onClick={onAssignmentClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show assignments list
  return (
    <div className="assignment-list" role="list" aria-label="Assignments">
      {assignments.length === 0 ? (
        <EmptyState onOpenSettings={onOpenSettings} />
      ) : (
        assignments.map((assignment) => (
          <AssignmentRow
            key={assignment.id}
            assignment={assignment}
            onClick={onAssignmentClick}
          />
        ))
      )}
    </div>
  );
}

/**
 * Individual assignment row component.
 * Extracted for clarity and potential reuse.
 */
interface AssignmentRowProps {
  assignment: Assignment;
  onClick?: (assignment: Assignment) => void;
}

function AssignmentRow({ assignment, onClick }: AssignmentRowProps): JSX.Element {
  const isOverdue = assignment.dueAt ? new Date(assignment.dueAt) < new Date() : false;
  const dueDate = assignment.dueAt
    ? new Date(assignment.dueAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No due date';

  const statusLabels: Record<Assignment['status'], string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
  };

  const statusColors: Record<Assignment['status'], string> = {
    pending: 'var(--status-pending, #f59e0b)',
    in_progress: 'var(--status-in-progress, #3b82f6)',
    completed: 'var(--status-completed, #10b981)',
  };

  const handleClick = () => {
    if (onClick) {
      onClick(assignment);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className="assignment-row"
      role="listitem"
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ '--course-color': assignment.courseColor } as React.CSSProperties}
      aria-label={`${assignment.title}, ${assignment.courseName}, due ${dueDate}, ${statusLabels[assignment.status]}`}
    >
      <div className="assignment-row__course">
        <span className="assignment-row__dot" aria-hidden="true" />
        <span className="assignment-row__course-name">{assignment.courseName}</span>
      </div>
      <div className="assignment-row__title">{assignment.title}</div>
      <div className="assignment-row__due" aria-label={`Due ${dueDate}`}>
        {isOverdue && <span className="assignment-row__overdue-badge" aria-label="Overdue">!</span>}
        <time dateTime={assignment.dueAt || undefined}>{dueDate}</time>
      </div>
      <div className="assignment-row__status">
        <span
          className="assignment-row__badge"
          style={{ backgroundColor: statusColors[assignment.status] }}
        >
          {statusLabels[assignment.status]}
        </span>
      </div>
    </div>
  );
}