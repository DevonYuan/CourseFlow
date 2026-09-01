/**
 * useAssignments Hook — Assignment Data Fetching & State Management
 *
 * Fetches assignments from the backend via IPC, handles loading/error/empty states,
 * and provides retry functionality. Listens for db:changed events to auto-refresh.
 * Uses Zustand store's memoized selector hooks for optimal performance.
 *
 * @module @frontend/hooks/useAssignments
 */

import { useCallback, useMemo } from 'react';
import type { Assignment } from '@backend/shared/types';
import {
  useAssignments as useAssignmentsSelector,
  useAssignmentsLoading,
  useAssignmentsError,
  useAssignmentsStore,
} from '../store/assignmentsStore';

interface UseAssignmentsReturn {
  /** Current list of assignments */
  assignments: Assignment[];
  /** Whether a fetch operation is in progress */
  isLoading: boolean;
  /** Error message if fetch failed (null if no error) */
  error: string | null;
  /** Whether the list is empty (no assignments and not loading) */
  isEmpty: boolean;
  /** Triggers a fresh fetch of assignments from the database */
  refetch: () => Promise<void>;
  /** Clears the current error state */
  clearError: () => void;
}

/**
 * Custom hook for managing assignment list state.
 * Uses Zustand store's memoized selector hooks to prevent unnecessary re-renders.
 */
export function useAssignments(): UseAssignmentsReturn {
  // Use memoized selector hooks from the store
  const assignments = useAssignmentsSelector();
  const isLoading = useAssignmentsLoading();
  const error = useAssignmentsError();

  // Compute isEmpty from other states (matches original hook behavior)
  const isEmpty = useMemo(() => !isLoading && assignments.length === 0 && error === null, [
    isLoading,
    assignments,
    error,
  ]);

  const refetch = useCallback(() => useAssignmentsStore.getState().fetchAssignments(), []);
  const clearError = useCallback(() => useAssignmentsStore.getState().clearError(), []);

  return {
    assignments,
    isLoading,
    error,
    isEmpty,
    refetch,
    clearError,
  };
}