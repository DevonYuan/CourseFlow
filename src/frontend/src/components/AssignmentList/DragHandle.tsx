/**
 * DragHandle — Reusable Drag Handle Component
 *
 * Provides a grip icon (⋮⋮) that serves as the drag handle for sortable items.
 * Only this area initiates drag operations.
 * Includes keyboard support for accessibility (Space/Enter to pick up).
 *
 * @module @frontend/components/AssignmentList/DragHandle
 */

import React from 'react';
import { forwardRef } from 'react';
import type { SyntheticEvent } from 'react';

import './DragHandle.css';

interface DragHandleProps {
  /** Unique ID for the draggable item */
  id: string;
  /** Whether the item is currently being dragged */
  isDragging?: boolean;
  /** Whether drag is disabled for this item */
  disabled?: boolean;
  /** Screen reader label */
  ariaLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler (for keyboard activation) */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Key down handler for keyboard activation */
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * Drag handle button with grip icon.
 * Uses a button element for proper keyboard accessibility.
 */
export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  (
    { id, isDragging = false, disabled = false, ariaLabel = 'Drag to reorder', className = '', onClick, onKeyDown },
    ref
  ) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // Prevent row click from firing when clicking drag handle
      event.stopPropagation();
      onClick?.(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // Allow Space and Enter to activate drag (handled by @dnd-kit KeyboardSensor)
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
      }
      onKeyDown?.(event);
    };

    return (
      <button
        ref={ref}
        type="button"
        id={`drag-handle-${id}`}
        className={`drag-handle${isDragging ? ' drag-handle--dragging' : ''}${disabled ? ' drag-handle--disabled' : ''} ${className}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-grabbed={isDragging}
        aria-describedby={`drag-handle-desc-${id}`}
        tabIndex={disabled ? -1 : 0}
      >
        <span className="drag-handle__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </span>
        <span id={`drag-handle-desc-${id}`} className="drag-handle__sr-only">
          {ariaLabel}
        </span>
      </button>
    );
  }
);

DragHandle.displayName = 'DragHandle';