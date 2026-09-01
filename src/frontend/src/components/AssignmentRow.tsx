/**
 * AssignmentRow — Individual Assignment Row Component
 *
 * Displays a single assignment with course color, title, due date, and status.
 * Supports keyboard navigation and click handling.
 *
 * @module @frontend/components/AssignmentRow
 */

import { CourseColorBadge } from './CourseColorBadge';
import type { Assignment } from '@backend/shared/types';
import './AssignmentRow.css';

interface AssignmentRowProps {
  /** Assignment data to display */
  assignment: Assignment;
  /** Callback when row is clicked */
  onClick?: (assignment: Assignment) => void;
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
 * Individual assignment row with click/keyboard handling.
 */
export function AssignmentRow({ assignment, onClick }: AssignmentRowProps): JSX.Element {
  const isOverdue = assignment.dueAt ? new Date(assignment.dueAt) < new Date() : false;
  const dueDate = formatDueDate(assignment.dueAt);

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
        {isOverdue && (
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
    </div>
  );
}