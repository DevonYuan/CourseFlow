/**
 * AssignmentRow — Individual Assignment Row Component
 *
 * Displays a single assignment with grip handle, course, title+progress, due date, status, checkbox.
 * Matches: docs/design-inspo/courseflow-dashbar-redesign.html
 *
 * @module @frontend/components/AssignmentRow
 */

import type { Assignment } from '@backend/shared/types';
import React from 'react';

import { CourseColorBadge } from './CourseColorBadge';
import { ProgressBar } from './ui/ProgressBar';
import './AssignmentRow.css';

interface SubTaskProgress {
  /** Number of completed sub-tasks */
  completedCount: number;
  /** Total number of sub-tasks */
  totalCount: number;
  /** Completion percentage (0-100) */
  percentage: number;
}

interface AssignmentRowProps {
  /** Assignment data to display */
  assignment: Assignment;
  /** Callback when row is clicked */
  onClick?: (assignment: Assignment) => void;
  /** Callback when mark complete is triggered */
  onMarkComplete?: (id: string) => Promise<void>;
  /** Whether the row is currently being dragged */
  isDragging?: boolean;
  /** Optional sub-task progress data for compact indicator */
  subTaskProgress?: SubTaskProgress;
  /** Ref setter from @dnd-kit useSortable */
  ref?: (element: HTMLDivElement | null) => void;
  /** Attributes from @dnd-kit useSortable for the root element */
  attributes?: { role: string; 'aria-roledescription': string; 'aria-describedby': string; tabIndex: number };
  /** Listeners from @dnd-kit useSortable for the drag handle */
  listeners?: { onMouseDown: (event: React.MouseEvent) => void; onKeyDown: (event: React.KeyboardEvent) => void; onTouchStart: (event: React.TouchEvent) => void };
}

/**
 * Formats due date as "Sat, Aug 15 · 10:00 AM" in local timezone.
 * Matches design inspiration format.
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
    hour12: true,
  });
  return `${day} · ${time}`;
}

const statusLabels: Record<Assignment['status'], string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

/**
 * Individual assignment row with click/keyboard handling and drag support.
 * Design: grip | course (dot + name) | title + progress | due | status badge | checkbox
 */
export function AssignmentRow({
  assignment,
  onClick,
  onMarkComplete,
  isDragging = false,
  subTaskProgress,
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

  // Determine if due date is urgent (within 24 hours and not completed)
  const isUrgent = !isCompleted && assignment.dueAt
    ? (new Date(assignment.dueAt).getTime() - Date.now()) < 24 * 60 * 60 * 1000
    : false;

  return (
    <div
      ref={mergedRef}
      {...attributes}
      className={`row${isCompleted ? ' row--completed' : ''}${isDragging ? ' row--dragging' : ''}`}
      role="listitem"
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ '--course-color': assignment.courseColor } as React.CSSProperties}
      aria-label={`${assignment.title}, ${assignment.courseName}, due ${dueDate}, ${statusLabels[assignment.status]}`}
      data-assignment-id={assignment.id}
    >
      {/* Grip / Drag Handle */}
      <div className="grip" {...listeners} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="6" r="1.4"/>
          <circle cx="16" cy="6" r="1.4"/>
          <circle cx="8" cy="12" r="1.4"/>
          <circle cx="16" cy="12" r="1.4"/>
          <circle cx="8" cy="18" r="1.4"/>
          <circle cx="16" cy="18" r="1.4"/>
        </svg>
      </div>

      {/* Course: colored dot + name */}
      <div className="row-course">
        <span className="dot-course" style={{ backgroundColor: assignment.courseColor }} aria-hidden="true"></span>
        <span>{assignment.courseName}</span>
      </div>

      {/* Main: Title + Progress */}
      <div className="row-main">
        <div className="row-title">{assignment.title}</div>
        {subTaskProgress && subTaskProgress.totalCount > 0 && (
          <div className="progress" role="status" aria-label={`${subTaskProgress.completedCount} of ${subTaskProgress.totalCount} sub-tasks complete`}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${subTaskProgress.percentage}%`, backgroundColor: assignment.courseColor }}></div>
            </div>
            <span className="progress-label">{subTaskProgress.completedCount}/{subTaskProgress.totalCount}</span>
          </div>
        )}
      </div>

      {/* Due Date */}
      <div className={`row-due${isUrgent ? ' urgent' : ''}`} aria-label={`Due ${dueDate}`}>
        {isOverdue && !isCompleted ? (
          <span className="row-due__icon" aria-label="Overdue">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </span>
        ) : isUrgent ? (
          <span className="row-due__icon" aria-label="Due soon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </span>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        )}
        <time dateTime={assignment.dueAt || undefined}>{dueDate}</time>
      </div>

      {/* Status Badge */}
      <div className="status-badge">
        {statusLabels[assignment.status]}
      </div>

      {/* Checkbox / Complete Button */}
      <div className="row-check-wrapper">
        {isCompleted ? (
          <div className="row-check-completed" aria-label="Completed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        ) : (
          <button
            className="row-check"
            onClick={handleMarkComplete}
            onKeyDown={handleMarkCompleteKeyDown}
            aria-label={`Mark ${assignment.title} as complete`}
            type="button"
            tabIndex={0}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
