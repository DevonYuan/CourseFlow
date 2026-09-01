/**
 * useAssignments Hook — Assignment Data Fetching & State Management
 *
 * Fetches assignments from the backend via IPC, handles loading/error/empty states,
 * and provides retry functionality. Listens for db:changed events to auto-refresh.
 *
 * @module @frontend/hooks/useAssignments
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Assignment } from '@backend/shared/types';
import type { IpcEvents } from '@backend/shared/ipc';
import { mapErrorToMessage } from '../utils/errorMessages';

interface UseAssignmentsState {
  /** Current list of assignments */
  assignments: Assignment[];
  /** Whether a fetch operation is in progress */
  isLoading: boolean;
  /** Error message if fetch failed (null if no error) */
  error: string | null;
  /** Whether the list is empty (no assignments and not loading) */
  isEmpty: boolean;
}

interface UseAssignmentsReturn extends UseAssignmentsState {
  /** Triggers a fresh fetch of assignments from the database */
  refetch: () => Promise<void>;
  /** Clears the current error state */
  clearError: () => void;
}

/**
 * Custom hook for managing assignment list state.
 * Handles fetching, loading skeletons, empty state, and error display with retry.
 */
export function useAssignments(): UseAssignmentsReturn {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch assignments from backend
  const fetchAssignments = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.db.assignments.list();

      if (!isMountedRef.current) return;

      if (result.ok) {
        setAssignments(result.data);
        setError(null);
      } else {
        // Create an error object with the IPC error code as the name
        // so mapErrorToMessage can map it to a user-friendly message
        const error = new Error(result.error);
        error.name = result.code || 'UNKNOWN_ERROR';
        const errorMessage = mapErrorToMessage(error);
        setError(errorMessage);
        setAssignments([]);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = mapErrorToMessage(err);
      setError(errorMessage);
      setAssignments([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Subscribe to database change events for auto-refresh
  useEffect(() => {
    const unsubscribe = window.api.onDbChanged((payload: IpcEvents['db:changed']) => {
      if (payload.table === 'assignments') {
        fetchAssignments();
      }
    });
    unsubscribeRef.current = unsubscribe;

    // Initial fetch
    fetchAssignments();

    return () => {
      isMountedRef.current = false;
      unsubscribeRef.current?.();
    };
  }, [fetchAssignments]);

  const refetch = useCallback(async () => {
    await fetchAssignments();
  }, [fetchAssignments]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isEmpty = !isLoading && assignments.length === 0 && error === null;

  return {
    assignments,
    isLoading,
    error,
    isEmpty,
    refetch,
    clearError,
  };
}