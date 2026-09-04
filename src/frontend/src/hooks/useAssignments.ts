/**
 * useAssignments Hook — Assignment Data Fetching & State Management
 *
 * Fetches assignments from the backend via IPC, handles loading/error/empty states,
 * and provides retry functionality. Subscribes to db:changed events to auto-refresh
 * with debouncing. Uses Zustand store's memoized selector hooks for optimal performance.
 *
 * @module @frontend/hooks/useAssignments
 */

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, EntityId, IsoDateTime } from '@backend/shared/types';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useToast } from '../context/ToastContext';
import {
  useAssignments as useAssignmentsSelector,
  useAssignmentsLoading,
  useAssignmentsError,
  useAssignmentsStore,
  useSetAssignmentStatus,
} from '../store/assignmentsStore';
import { debounce } from '../utils/debounce';

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
  /** Marks an assignment as completed with optimistic update */
  markComplete: (id: string) => Promise<void>;
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
  const setAssignmentStatus = useSetAssignmentStatus();
  const { success: toastSuccess, error: toastError } = useToast();

  // Compute isEmpty from other states (matches original hook behavior)
  const isEmpty = useMemo(() => !isLoading && assignments.length === 0 && error === null, [
    isLoading,
    assignments,
    error,
  ]);

  const refetch = useCallback(() => useAssignmentsStore.getState().fetchAssignments(), []);
  const clearError = useCallback(() => useAssignmentsStore.getState().clearError(), []);

  // Debounced refetch for auto-refresh (100ms debounce to handle batch imports)
  const debouncedRefetchRef = useRef(
    debounce(() => useAssignmentsStore.getState().fetchAssignments(), 100),
  );

  // Subscribe to db:changed events for auto-refresh
  useEffect(() => {
    const unsubscribe = window.api.onDbChanged((event: IpcEvents['db:changed']) => {
      // Only re-fetch on assignments table changes (insert, update, delete, upsert)
      if (event.table === 'assignments') {
        debouncedRefetchRef.current();
      }
    });

    // Capture ref for cleanup to avoid react-hooks/exhaustive-deps warning
    const debouncedRefetch = debouncedRefetchRef.current;

    // Cleanup on unmount
    return () => {
      unsubscribe();
      debouncedRefetch.cancel();
    };
  }, []);

  const markComplete = useCallback(
    async (id: string) => {
      // 1. Optimistic update
      const previousAssignments = assignments;
      setAssignmentStatus(id, 'completed');

      try {
        // 2. IPC call
        const result = await window.api.db.assignments.upsert({
          id: id as EntityId,
          status: 'completed',
          updatedAt: new Date().toISOString() as IsoDateTime,
        });

        if (!result.ok) {
          throw new Error(result.error);
        }

        // 3. Success toast
        toastSuccess('Marked complete');
      } catch {
        // 4. Rollback on failure
        setAssignmentStatus(id, previousAssignments.find((a) => a.id === id)?.status ?? 'pending');
        toastError('Failed to update. Try again.');
      }
    },
    [assignments, setAssignmentStatus, toastSuccess, toastError]
  );

  return {
    assignments,
    isLoading,
    error,
    isEmpty,
    refetch,
    clearError,
    markComplete,
  };
}