/**
 * AssignmentHeader — Assignment Detail Header Component
 *
 * Renders the assignment header section: back button, title, course badge,
 * due date (with overdue/all-day handling), status, points, and description.
 * Used by the assignment detail page.
 *
 * @module @frontend/components/assignments/AssignmentHeader
 */

import type { Assignment } from '@backend/shared/types';
import React from 'react';

import { formatDueDateDetail } from '../../utils/date';
import { createSafeHtml } from '../../utils/sanitize';
import { StatusBadge } from '../AssignmentList/StatusBadge';
import { CourseColorBadge } from '../CourseColorBadge';

interface AssignmentHeaderProps {
  /** Assignment data to display */
  assignment: Assignment;
  /** Callback when back button is clicked */
  onBack: () => void;
  /** Callback when "Open in Canvas" is clicked */
  onOpenInCanvas: () => void;
}

/**
 * AssignmentHeader - Displays assignment identity and metadata.
 * Includes: back button, title, course badge, due date, status, points, and
 * the "Open in Canvas" link.
 */
export function AssignmentHeader({
  assignment,
  onBack,
  onOpenInCanvas,
}: AssignmentHeaderProps): JSX.Element {
  const { label: dueDateLabel, isOverdue, isAllDay } = formatDueDateDetail(assignment.dueAt);

  return (
    <header className="assignment-detail__header">
      {/* Back button */}
      <button
        className="assignment-detail__back"
        onClick={onBack}
        type="button"
        aria-label="Back to assignments"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Back</span>
      </button>

      {/* Title and Course */}
      <div className="assignment-detail__title-section">
        <h1 className="assignment-detail__title">{assignment.title}</h1>
        <div className="assignment-detail__course">
          <CourseColorBadge
            color={assignment.courseColor}
            variant="dot"
            size={12}
            ariaLabel={`${assignment.courseName} color`}
          />
          <span className="assignment-detail__course-name">{assignment.courseName}</span>
        </div>
      </div>

      {/* Meta: Due date, status, points */}
      <div className="assignment-detail__meta">
        <div className="assignment-detail__due-date">
          <svg className="assignment-detail__due-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span
            className={`assignment-detail__due-label${isOverdue ? ' assignment-detail__due-label--overdue' : ''}${isAllDay ? ' assignment-detail__due-label--allday' : ''}`}
          >
            {dueDateLabel}
          </span>
        </div>

        <StatusBadge status={assignment.status} size="md" />

        {assignment.pointsPossible !== null && assignment.pointsPossible > 0 && (
          <span className="assignment-detail__points" aria-label={`Worth ${assignment.pointsPossible} points`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {assignment.pointsPossible} pts
          </span>
        )}
      </div>

      {/* Description */}
      {assignment.description && assignment.description.trim() !== '' && (
        <section className="assignment-detail__section" aria-labelledby="description-heading">
          <h2 id="description-heading" className="assignment-detail__section-title">
            Description
          </h2>
          <div
            className="assignment-detail__description"
            dangerouslySetInnerHTML={createSafeHtml(assignment.description)}
          />
        </section>
      )}

      {/* Canvas link footer note (style keeps parity with old inline footer) */}
      {assignment.htmlUrl && (
        <button
          className="assignment-detail__canvas-link"
          onClick={onOpenInCanvas}
          type="button"
          aria-label={`Open ${assignment.title} in Canvas`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open in Canvas
        </button>
      )}
    </header>
  );
}