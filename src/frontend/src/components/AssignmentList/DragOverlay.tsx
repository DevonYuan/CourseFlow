/**
 * DragOverlay — Custom Drag Overlay Component
 *
 * Renders the dragged item as an overlay during drag operations.
 * Provides visual feedback with opacity, shadow, and rotation.
 *
 * @module @frontend/components/AssignmentList/DragOverlay
 */

import type { Assignment } from '@backend/shared/types';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';

import { AssignmentRow } from '../AssignmentRow';

import './DragOverlay.css';

interface DragOverlayProps {
  /** The assignment being dragged */
  assignment: Assignment;
  /** Callback when assignment row is clicked */
  onClick?: (assignment: Assignment) => void;
  /** Callback when mark complete is triggered */
  onMarkComplete?: (id: string) => Promise<void>;
  /** Transform from @dnd-kit DragOverlay render prop */
  transform?: { x: number; y: number; scaleX: number; scaleY: number } | null;
  /** Transition from @dnd-kit DragOverlay render prop */
  transition?: string;
}

/**
 * Custom drag overlay that renders the assignment row with drag styling.
 * Receives transform and transition from @dnd-kit's DragOverlay render prop.
 */
export function DragOverlay({
  assignment,
  onClick,
  onMarkComplete,
  transform,
  transition,
}: DragOverlayProps): JSX.Element {
  // Use @dnd-kit's CSS utility for transform
  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    // Additional drag styling
    opacity: 0.9,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
  } as React.CSSProperties;

  return (
    <div className="drag-overlay" style={style}>
      <AssignmentRow assignment={assignment} onClick={onClick} onMarkComplete={onMarkComplete} />
    </div>
  );
}
