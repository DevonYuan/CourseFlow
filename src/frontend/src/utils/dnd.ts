/**
 * Drag-and-Drop Utilities for Tree Structures
 *
 * Extends Phase 2 DnD utilities with tree-specific logic for nesting,
 * reordering, and position calculation.
 *
 * @module @frontend/utils/dnd
 */

import type { EntityId } from '@backend/shared/types';
import { CSS } from '@dnd-kit/utilities';
import type { Transform } from '@dnd-kit/utilities';

/**
 * Drop position relative to a target item.
 */
export type DropPosition = 'before' | 'after' | 'inside';

/**
 * Drop target information for tree DnD.
 */
export interface TreeDropTarget {
  /** Target item ID */
  id: EntityId;
  /** Drop position relative to target */
  position: DropPosition;
  /** Target item depth */
  depth: number;
  /** Whether target is a valid drop target */
  isValid: boolean;
}

/**
 * Calculate drop position based on mouse position relative to target element.
 * Uses the same approach as @dnd-kit's built-in collision detection.
 */
export function calculateDropPosition(
  event: { clientY: number },
  targetRect: DOMRect,
  targetDepth: number,
  dragDepth: number,
): DropPosition {
  const offset = event.clientY - targetRect.top;
  const relativePosition = offset / targetRect.height;

  // If dragging onto a parent (different depth), default to inside
  if (dragDepth < targetDepth) {
    return 'inside';
  }

  // If dragging to same level or higher, use before/after
  if (relativePosition < 0.25) {
    return 'before';
  }
  if (relativePosition > 0.75) {
    return 'after';
  }

  // Middle area - inside if target can have children, otherwise after
  return 'inside';
}

/**
 * Determine if a drop position would create a valid tree structure.
 */
export function isValidDropPosition(
  dragId: EntityId,
  targetId: EntityId,
  position: DropPosition,
  getDescendants: (id: EntityId) => EntityId[],
  getParent: (id: EntityId) => EntityId | null,
): boolean {
  // Can't drop on self
  if (dragId === targetId) return false;

  // Can't drop into own descendants
  const descendants = getDescendants(dragId);
  if (descendants.includes(targetId)) return false;

  // For 'inside' drops, target becomes parent
  if (position === 'inside') {
    // Check if target is a descendant of drag (already checked above)
    // Also check if target is the drag item itself (already checked)
    return true;
  }

  // For 'before'/'after', new parent would be target's parent
  const newParent = getParent(targetId);
  // Moving next to a child of the dragged node would nest it under itself.
  if (newParent === dragId) return false;
  if (newParent !== null) {
    const newParentDescendants = getDescendants(newParent);
    if (newParentDescendants.includes(dragId)) return false;
  }

  return true;
}

/**
 * Calculate new position index for a page being moved.
 */
export function calculateNewPosition(
  position: DropPosition,
  targetIndex: number,
  siblingsCount: number,
): number {
  switch (position) {
    case 'before': {
      return targetIndex;
    }
    case 'after': {
      return targetIndex + 1;
    }
    case 'inside': {
      return 0;
    } // As first child
    default: {
      return siblingsCount;
    }
  }
}

/**
 * Get the CSS transform for a draggable item during drag.
 */
export function getDragTransform(transform: Transform | null): string {
  if (!transform) return '';
  return CSS.Transform.toString(transform) ?? '';
}

/**
 * Default icon for a page.
 */
export const DEFAULT_PAGE_ICON = '📄';

/**
 * Default icon for a folder (page with children).
 */
export const DEFAULT_FOLDER_ICON = '📁';

/**
 * Get icon for a page based on its properties.
 */
export function getPageIcon(page: { icon: string | null; children?: unknown[] }): string {
  if (page.icon) return page.icon;
  // If page has children and no explicit icon, use folder icon
  if (page.children && page.children.length > 0) {
    return DEFAULT_FOLDER_ICON;
  }
  return DEFAULT_PAGE_ICON;
}

/**
 * Keyboard navigation directions for tree.
 */
export type TreeNavDirection = 'up' | 'down' | 'left' | 'right';
