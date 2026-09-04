/**
 * AssignmentRow — Individual Assignment Row Component
 *
 * Displays a single assignment with course color, title, due date, and status.
 * Supports keyboard navigation, click handling, and drag-and-drop reordering.
 *
 * @module @frontend/components/AssignmentRow
 */

import React from 'react';
import type { Assignment } from '@backend/shared/types';

import { CourseColorBadge } from './CourseColorBadge';
import { DragHandle } from './AssignmentList/DragHandle';
import './AssignmentRow.css';

interface AssignmentRowProps {
  /** Assignment data to display */
  assignment: Assignment;
  /** Callback when row is clicked */
  onClick?: (assignment: Assignment) => void;
  /** Callback when mark complete is triggered */
  onMarkComplete?: (id: string) => Promise<void>;
  /** Whether the row is currently being dragged */
  isDragging?: boolean;
  /** Ref setter from @dnd-kit useSortable */
  ref?: (element: HTMLDivElement | null) => void;
  /** Attributes from @dnd-kit useSortable for the root element */
  attributes?: { role: string; 'aria-roledescription': string; 'aria-describedby': string; tabIndex: number };
  /** Listeners from @dnd-kit useSortable for the drag handle */
  listeners?: { onMouseDown: (event: React.MouseEvent) => void; onKeyDown: (event: React.KeyboardEvent) => void; onTouchStart: (event: React.TouchEvent) => void };
}

/**
 * Formats due date as "Mon, Jan 15 • 11:59 PM" in local timezone.
 */
function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return 'No due date';

  const date = new Date(dueAt);
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} • ${time}`;
}

const statusLabels: Record<Assignment['status'], string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

const statusColors: Record<Assignment['status'], string> = {
  pending: 'var(--status-pending, #f59e0b)',
  in_progress: 'var(--status-in-progress, #3b82f6)',
  completed: 'var(--status-completed, #10b981)',
  archived: 'var(--status-archived, #9ca3af)',
};

/**
 * Individual assignment row with click/keyboard handling and drag support.
 */
export function AssignmentRow({
  assignment,
  onClick,
  onMarkComplete,
  isDragging = false,
  ref,
  attributes,
  listeners,
}: AssignmentRowProps): JSX.Element {
  const isOverdue = assignment.dueAt ? new Date(assignment.dueAt) < new Date() : false;
  const dueDate = formatDueDate(assignment.dueAt);
  const isCompleted = assignment.status === 'completed';

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

  const handleMarkComplete = (event: React.MouseEvent) => {
    // Prevent row click from firing
    event.stopPropagation();
    if (onMarkComplete && !isCompleted) {
      void onMarkComplete(assignment.id);
    }
  };

  const handleMarkCompleteKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (onMarkComplete && !isCompleted) {
        void onMarkComplete(assignment.id);
      }
    }
  };

  // Merge ref with dnd-kit ref
  const mergedRef = ref;

  return (
    <div
      ref={mergedRef}
      {...attributes}
      className={`assignment-row${isCompleted ? ' assignment-row--completed' : ''}${isDragging ? ' assignment-row--dragging' : ''}`}
      role="listitem"
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ '--course-color': assignment.courseColor } as React.CSSProperties}
      aria-label={`${assignment.title}, ${assignment.courseName}, due ${dueDate}, ${statusLabels[assignment.status]}`}
      data-assignment-id={assignment.id}
    >
      <div className="assignment-row__drag-handle">
        <DragHandle
          id={assignment.id}
          isDragging={isDragging}
          disabled={isCompleted}
          ariaLabel={`Drag to reorder ${assignment.title}`}
          {...listeners}
        />
      </div>
      <div className="assignment-row__course">
        <CourseColorBadge
          color={assignment.courseColor}
          variant="dot"
          size={10}
          ariaLabel={`${assignment.courseName} color`}
        />
        <span className="assignment-row__course-name">{assignment.courseName}</span>
      </div>
      <div className="assignment-row__title">{assignment.title}</div>
      <div className="assignment-row__due" aria-label={`Due ${dueDate}`}>
        {isOverdue && !isCompleted && (
          <span className="assignment-row__overdue-badge" aria-label="Overdue">
            !
          </span>
        )}
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
      <div className="assignment-row__action">
        {isCompleted ? (
          <span className="assignment-row__completed-icon" aria-label="Completed">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        ) : (
          <button
            type="button"
            className="assignment-row__complete-btn"
            onClick={handleMarkComplete}
            onKeyDown={handleMarkCompleteKeyDown}
            aria-label={`Mark "${assignment.title}" as complete`}
            aria-pressed={false}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}