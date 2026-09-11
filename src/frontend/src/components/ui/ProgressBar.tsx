/**
 * ProgressBar — Reusable Progress Bar Component
 *
 * Displays a progress bar with optional label and percentage.
 * Supports different sizes, custom colors, and accessibility features.
 * Animates on value change, respects prefers-reduced-motion.
 *
 * @module @frontend/components/ui/ProgressBar
 */

import React from 'react';

import './ProgressBar.css';

export type ProgressBarSize = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Optional label to display (e.g., "3/5") */
  label?: string;
  /** Size variant: 'sm' (8px), 'md' (12px), 'lg' (16px) */
  size?: ProgressBarSize;
  /** Custom color for the progress fill (course color) */
  color?: string;
  /** Whether to show percentage text next to the bar */
  showPercentage?: boolean;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Additional CSS class */
  className?: string;
  /** Click handler for detail view (scrolls to sub-tasks) */
  onClick?: () => void;
}

/**
 * ProgressBar - Reusable progress indicator component.
 * Uses CSS custom properties for theming and animation.
 */
export function ProgressBar({
  value,
  label,
  size = 'md',
  color,
  showPercentage = false,
  ariaLabel,
  className = '',
  onClick,
}: ProgressBarProps): JSX.Element {
  const clampedValue = Math.max(0, Math.min(100, value));

  // Generate default ariaLabel if not provided
  const defaultAriaLabel = label
    ? `Sub-task progress: ${label}, ${clampedValue} percent`
    : `Progress: ${clampedValue} percent`;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`progress-bar${className ? ` ${className}` : ''} progress-bar--${size}`}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || defaultAriaLabel}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      style={
        {
          '--progress-color': color || 'var(--color-accent, #3b82f6)',
          '--progress-value': `${clampedValue}%`,
        } as React.CSSProperties
      }
    >
      <div className="progress-bar__track" aria-hidden="true">
        <div className="progress-bar__fill" />
      </div>
      {(label || showPercentage) && (
        <div className="progress-bar__label" aria-hidden="true">
          {label && <span className="progress-bar__label-text">{label}</span>}
          {showPercentage && <span className="progress-bar__percentage">{clampedValue}%</span>}
        </div>
      )}
    </div>
  );
}
