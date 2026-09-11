/**
 * useFocusRestoration — Hook for managing focus restoration
 *
 * Provides utilities to save and restore focus before/after navigation,
 * modal opening, or other context changes. Essential for accessibility
 * compliance (WCAG 2.4.3 Focus Order).
 *
 * @module @frontend/hooks/useFocusRestoration
 */

import { useCallback, useRef } from 'react';

/**
 * Hook for saving and restoring focus
 * @returns Object with saveFocus and restoreFocus functions
 */
export function useFocusRestoration(): {
  saveFocus: () => void;
  restoreFocus: () => void;
  clearSavedFocus: () => void;
} {
  const savedElementRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    savedElementRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (savedElementRef.current && typeof savedElementRef.current.focus === 'function') {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        savedElementRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  }, []);

  const clearSavedFocus = useCallback(() => {
    savedElementRef.current = null;
  }, []);

  return { saveFocus, restoreFocus, clearSavedFocus };
}

/**
 * Hook for saving focus on mount and restoring on unmount
 * Useful for components that take focus temporarily (modals, dialogs)
 * @param isOpen - Whether the component is open/active
 * @param onClose - Optional callback when focus is restored
 */
export function useFocusOnMount(
  isOpen: boolean,
  onClose?: () => void,
): { saveFocus: () => void; restoreFocus: () => void } {
  const { saveFocus, restoreFocus } = useFocusRestoration();

  // Save focus when component opens
  // We use a ref to track previous state to avoid multiple saves
  const wasOpenRef = useRef(false);

  if (isOpen && !wasOpenRef.current) {
    saveFocus();
    wasOpenRef.current = true;
  } else if (!isOpen && wasOpenRef.current) {
    restoreFocus();
    wasOpenRef.current = false;
    onClose?.();
  }

  return { saveFocus, restoreFocus };
}
