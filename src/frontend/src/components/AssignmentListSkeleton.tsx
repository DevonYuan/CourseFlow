/**
 * AssignmentListSkeleton — Skeleton Loader for Assignment Rows
 *
 * Displays 3-5 animated skeleton rows matching the visual structure
 * of AssignmentRow while data is loading.
 * CSS-only shimmer animation, no JS dependencies.
 *
 * @module @frontend/components/AssignmentListSkeleton
 */

import React from 'react';
import './AssignmentListSkeleton.css';

interface AssignmentListSkeletonProps {
  /** Number of skeleton rows to show (default: 4) */
  count?: number;
}

/**
 * Skeleton loader for assignment list.
 * Renders configurable number of animated placeholder rows.
 */
export function AssignmentListSkeleton({ count = 4 }: AssignmentListSkeletonProps): JSX.Element {
  const rows = Array.from({ length: count }, (_, i) => i);

  return (
    <div
      className="assignment-list-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Loading assignments"
    >
      {rows.map((index) => (
        <div key={index} className="skeleton-row" data-testid="skeleton-row">
          <div className="skeleton-cell skeleton-course">
            <span className="skeleton-dot" aria-hidden="true" />
            <div className="skeleton-text skeleton-course-name" aria-hidden="true" />
          </div>
          <div className="skeleton-cell skeleton-title">
            <div className="skeleton-text skeleton-title-text" aria-hidden="true" />
          </div>
          <div className="skeleton-cell skeleton-due">
            <div className="skeleton-text skeleton-due-text" aria-hidden="true" />
          </div>
          <div className="skeleton-cell skeleton-status">
            <div className="skeleton-badge" aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}
