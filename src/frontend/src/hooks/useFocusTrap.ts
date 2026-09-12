/**
 * useFocusTrap — Hook for trapping focus within an element
 *
 * Implements accessible focus trapping for modals, dialogs, and other
 * overlay components. Based on WAI-ARIA Dialog pattern.
 *
 * @module @frontend/hooks/useFocusTrap
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  isActive: boolean;
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Element to focus initially (defaults to first focusable) */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Element to return focus to when trap deactivates */
  returnFocusRef?: React.RefObject<HTMLElement>;
  /** Whether to click outside to close (for overlays) */
  clickOutsideToClose?: boolean;
}

/**
 * Focus trap hook for accessible modal dialogs
 */
export function useFocusTrap({
  isActive,
  onEscape,
  initialFocusRef,
  returnFocusRef,
  clickOutsideToClose = false,
}: UseFocusTrapOptions): React.RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    const elements = [
      ...containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
      ),
    ].filter((el) => {
      // Filter out hidden/disabled elements
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !el.hasAttribute('disabled') &&
        !el.getAttribute('aria-hidden')
      );
    });
    focusableElementsRef.current = elements;
    return elements;
  }, []);

  // Handle tab key for focus trapping
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    },
    [isActive, getFocusableElements],
  );

  // Handle Escape key
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Escape') return;
      event.preventDefault();
      onEscape?.();
    },
    [isActive, onEscape],
  );

  // Handle click outside
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!isActive || !clickOutsideToClose) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onEscape?.();
      }
    },
    [isActive, clickOutsideToClose, onEscape],
  );

  // Manage focus trap lifecycle
  useEffect(() => {
    if (isActive) {
      // Save current active element
      previousActiveElement.current = document.activeElement as HTMLElement;
      const returnElement = returnFocusRef?.current;

      // Add event listeners
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleEscape);
      if (clickOutsideToClose) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      // Focus initial element
      setTimeout(() => {
        getFocusableElements();
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus({ preventScroll: true });
        } else if (focusableElementsRef.current.length > 0) {
          focusableElementsRef.current[0]?.focus({ preventScroll: true });
        }
      }, 0);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('mousedown', handleClickOutside);
        document.body.style.overflow = '';

        // Restore focus to return element or previously focused element
        setTimeout(() => {
          const element = returnElement ?? previousActiveElement.current;
          if (element && typeof element.focus === 'function') {
            element.focus({ preventScroll: true });
          }
        }, 0);
      };
    }
  }, [
    isActive,
    handleKeyDown,
    handleEscape,
    handleClickOutside,
    getFocusableElements,
    initialFocusRef,
    returnFocusRef,
    clickOutsideToClose,
  ]);

  return containerRef;
}
