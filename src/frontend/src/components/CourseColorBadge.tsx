/**
 * CourseColorBadge — Colored Indicator Component
 *
 * Displays a colored dot/square representing a course color.
 * Used in assignment rows and course headers.
 *
 * @module @frontend/components/CourseColorBadge
 */

import React from 'react';
import './CourseColorBadge.css';

interface CourseColorBadgeProps {
  /** Hex color string (e.g., '#e8a838') */
  color: string;
  /** Badge variant */
  variant?: 'dot' | 'square';
  /** Badge size in pixels */
  size?: number;
  /** Accessible label for the badge */
  ariaLabel?: string;
}

/**
 * Renders a colored badge for course identification.
 */
export function CourseColorBadge({
  color,
  variant = 'dot',
  size = 10,
  ariaLabel,
}: CourseColorBadgeProps): JSX.Element {
  const className = `course-color-badge course-color-badge--${variant}`;

  return (
    <span
      className={className}
      style={
        {
          width: size,
          height: size,
          backgroundColor: color,
          '--badge-size': `${size}px`,
        } as React.CSSProperties
      }
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    />
  );
}
