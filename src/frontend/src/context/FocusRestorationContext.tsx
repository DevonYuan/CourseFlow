/**
 * FocusRestorationContext — Global focus management for navigation
 *
 * Provides a context for saving/restoring focus across route navigation.
 * Used by AssignmentListPage to save focus before navigation, and by
 * AssignmentDetailPage to restore focus on back navigation.
 *
 * @module @frontend/context/FocusRestorationContext
 */

import React, { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';

interface FocusRestorationContextValue {
  /** Save the currently focused element (call before navigation) */
  saveFocus: (element?: HTMLElement) => void;
  /** Restore focus to the saved element (call on back navigation) */
  restoreFocus: () => void;
  /** Clear the saved focus reference */
  clearFocus: () => void;
}

const FocusRestorationContext = createContext<FocusRestorationContextValue | null>(null);

/**
 * Provider component for focus restoration context
 */
export function FocusRestorationProvider({ children }: { children: ReactNode }): JSX.Element {
  const savedElementRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback((element?: HTMLElement) => {
    savedElementRef.current = element ?? (document.activeElement as HTMLElement);
  }, []);

  const restoreFocus = useCallback(() => {
    if (savedElementRef.current && typeof savedElementRef.current.focus === 'function') {
      setTimeout(() => {
        savedElementRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  }, []);

  const clearFocus = useCallback(() => {
    savedElementRef.current = null;
  }, []);

  return (
    <FocusRestorationContext.Provider value={{ saveFocus, restoreFocus, clearFocus }}>
      {children}
    </FocusRestorationContext.Provider>
  );
}

/**
 * Hook to access focus restoration context
 * @throws Error if used outside FocusRestorationProvider
 */
export function useFocusRestorationContext(): FocusRestorationContextValue {
  const context = useContext(FocusRestorationContext);
  if (!context) {
    throw new Error('useFocusRestorationContext must be used within a FocusRestorationProvider');
  }
  return context;
}
