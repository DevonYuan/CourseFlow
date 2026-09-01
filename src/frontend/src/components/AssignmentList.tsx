/**
 * AssignmentList — Main Assignment List Component
 *
 * Displays assignments with loading skeleton, empty state, and error handling.
 * Uses Zustand store for state management and react-window for virtualization.
 *
 * @module @frontend/components/AssignmentList
 */

import { useEffect, useMemo } from 'react';
import { List } from 'react-window';
import { AssignmentListSkeleton } from './AssignmentListSkeleton';
import { EmptyState } from './EmptyState';
import { AssignmentRow } from './AssignmentRow';
import {
  useAssignmentsStore,
  useAssignments,
  useAssignmentsLoading,
  useAssignmentsError,
  useAssignmentsEmpty,
  initializeAssignmentsStore,
} from '../store/assignmentsStore';
import type { Assignment } from '@backend/shared/types';
import './AssignmentList.css';

// Virtualization threshold - use virtualized list when > 100 items
const VIRTUALIZATION_THRESHOLD = 100;
// Estimated row height for virtualization
const ROW_HEIGHT = 72;

interface AssignmentListProps {
  /** Callback fired when user clicks "Open Settings" from empty state */
  onOpenSettings: () => void;
  /** Optional callback when an assignment is clicked */
  onAssignmentClick?: (assignment: Assignment) => void;
}

/**
 * Row renderer for react-window FixedSizeList.
 */
function AssignmentRowRenderer(
  props: { index: number; style: React.CSSProperties; ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' }; assignments: Assignment[]; onClick?: (assignment: Assignment) => void }
): React.ReactElement | null {
  const { index, style, assignments, onClick, ...rest } = props;
  const assignment = assignments[index];
  // react-window only calls renderer with valid indices, but TypeScript needs assurance
  if (!assignment) {
    return <div style={style} {...rest} />;
  }
  return (
    <div style={style} {...rest}>
      <AssignmentRow assignment={assignment} onClick={onClick} />
    </div>
  );
}

/**
 * Main assignment list component with full state handling:
 * - Skeleton loaders while fetching
 * - Empty state with CTA to Settings
 * - Error state with retry button
 * - Assignment rows when data available (virtualized if > 100)
 */
export function AssignmentList({ onOpenSettings, onAssignmentClick }: AssignmentListProps): JSX.Element {
  // Initialize store on first mount
  useEffect(() => {
    const cleanup = initializeAssignmentsStore();
    return cleanup;
  }, []);

  // Select state from Zustand store
  const assignments = useAssignments();
  const isLoading = useAssignmentsLoading();
  const error = useAssignmentsError();
  const isEmpty = useAssignmentsEmpty();

  // Memoize refetch and clearError from store actions
  const refetch = useMemo(
    () => useAssignmentsStore.getState().fetchAssignments,
    []
  );
  const clearError = useMemo(
    () => useAssignmentsStore.getState().clearError,
    []
  );

  // Show skeleton while loading
  if (isLoading) {
    return <AssignmentListSkeleton count={4} />;
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
            {assignments.length > VIRTUALIZATION_THRESHOLD ? (
              <VirtualizedAssignmentList
                assignments={assignments}
                onAssignmentClick={onAssignmentClick}
              />
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
        )}
      </div>
    );
  }

  // Show assignments list
  return (
    <div className="assignment-list" role="list" aria-label="Assignments">
      {assignments.length === 0 ? (
        <EmptyState onOpenSettings={onOpenSettings} />
      ) : assignments.length > VIRTUALIZATION_THRESHOLD ? (
        <VirtualizedAssignmentList
          assignments={assignments}
          onAssignmentClick={onAssignmentClick}
        />
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
 * Virtualized assignment list using react-window.
 * Only renders visible rows for performance with large lists.
 */
function VirtualizedAssignmentList({
  assignments,
  onAssignmentClick,
}: {
  assignments: Assignment[];
  onAssignmentClick?: (assignment: Assignment) => void;
}): JSX.Element {
  const itemData = useMemo(
    () => ({ assignments, onClick: onAssignmentClick }),
    [assignments, onAssignmentClick]
  );

  return (
    <List<{ assignments: Assignment[]; onClick?: (assignment: Assignment) => void }>
      className="assignment-list__virtualized"
      style={{ height: 600, width: '100%' }}
      rowCount={assignments.length}
      rowHeight={ROW_HEIGHT}
      rowProps={itemData}
      role="list"
      aria-label="Assignments"
      rowComponent={AssignmentRowRenderer}
    />
  );
}