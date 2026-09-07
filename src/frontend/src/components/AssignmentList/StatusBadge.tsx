/**
 * StatusBadge — Reusable Status Badge Component
 *
 * Displays assignment status with consistent styling across the app.
 *
 * @module @frontend/components/AssignmentList/StatusBadge
 */

import type { AssignmentStatus } from '@backend/shared/types';
import React from 'react';

import './StatusBadge.css';

type BadgeSize = 'sm' | 'md' | 'lg';

const statusLabels: Record<AssignmentStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'status-badge--sm',
  md: 'status-badge--md',
  lg: 'status-badge--lg',
};

interface StatusBadgeProps {
  /** Assignment status to display */
  status: AssignmentStatus;
  /** Badge size variant */
  size?: BadgeSize;
  /** Additional class names */
  className?: string;
}

/**
 * StatusBadge - Displays a colored badge with the assignment status label.
 */
export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={`status-badge ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: `var(--status-${status}, ${getStatusColor(status)})` } as React.CSSProperties}
      aria-label={`Status: ${statusLabels[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

/**
 * Fallback colors if CSS variables aren't available.
 */
function getStatusColor(status: AssignmentStatus): string {
  switch (status) {
    case 'pending': {
      return '#f59e0b';
    }
    case 'in_progress': {
      return '#3b82f6';
    }
    case 'completed': {
      return '#10b981';
    }
    case 'archived': {
      return '#9ca3af';
    }
  }
}