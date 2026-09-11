/**
 * usePriorityKeyboard Hook — Keyboard Shortcuts for Priority Reordering
 *
 * Provides global keyboard shortcuts for moving assignments in the priority list:
 * - Alt+Up / Alt+Down: Move up/down by one position
 * - Alt+Shift+Up / Alt+Shift+Down: Move to top/bottom
 *
 * Only activates when the assignment list (or a row/drag handle) is focused.
 * Announces changes via ARIA live region callback.
 *
 * @module @frontend/hooks/usePriorityKeyboard
 */

import { useCallback, useEffect } from 'react';

import { useMoveAssignment } from '../store/assignmentsStore';
import { useAssignments as useAssignmentsSelector } from '../store/assignmentsStore';

interface UsePriorityKeyboardOptions {
  /** Callback fired when a move is announced for screen readers */
  onAnnounce?: (message: string) => void;
  /** Whether the keyboard shortcuts are enabled */
  enabled?: boolean;
}

/**
 * Custom hook for priority keyboard shortcuts.
 * Registers global keydown listener but only acts when list/row is focused.
 */
export function usePriorityKeyboard({
  onAnnounce,
  enabled = true,
}: UsePriorityKeyboardOptions): void {
  const moveAssignment = useMoveAssignment();
  const assignments = useAssignmentsSelector();

  // Track if we're currently in the assignment list context
  const isInListContext = useCallback((): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    // Check if active element is the list, a row, or a drag handle
    return (
      activeElement.closest('.assignment-list') !== null ||
      activeElement.closest('.assignment-row') !== null ||
      activeElement.closest('.drag-handle') !== null
    );
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      if (!isInListContext()) return;

      // Check for Alt+Up/Down or Alt+Shift+Up/Down
      const isAlt = event.altKey;
      const isShift = event.shiftKey;
      const isUp = event.key === 'ArrowUp';
      const isDown = event.key === 'ArrowDown';

      if (!isAlt || (!isUp && !isDown)) return;

      // Prevent default browser behavior (e.g., Alt+Up might navigate history)
      event.preventDefault();
      event.stopPropagation();

      const focusedRow = document.activeElement?.closest('.assignment-row') as HTMLElement | null;
      if (!focusedRow) return;

      const assignmentId = focusedRow.dataset['assignmentId'];
      if (!assignmentId) return;

      // Determine direction
      let direction: 'up' | 'down' | 'top' | 'bottom';
      if (isUp && isShift) direction = 'top';
      else if (isDown && isShift) direction = 'bottom';
      else if (isUp) direction = 'up';
      else direction = 'down';

      // Execute move
      const result = moveAssignment(assignmentId, direction);
      if (!result) return;

      // Find the assignment title for announcement
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment) return;

      // Announce to screen readers
      const position = result.newIndex + 1; // 1-based for announcement
      const total = result.total;
      const message = `Moved "${assignment.title}" to position ${position} of ${total}`;
      onAnnounce?.(message);

      // Focus stays on the moved row (handled by AssignmentRow's data-assignment-id)
      // The row element remains the same, just reordered in DOM
    },
    [enabled, isInListContext, moveAssignment, assignments, onAnnounce],
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);
}
