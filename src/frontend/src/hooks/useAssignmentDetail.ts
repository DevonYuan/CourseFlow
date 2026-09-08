/**
 * useAssignmentDetail Hook — Assignment Detail Data Loading
 *
 * Loads a single assignment's data (assignment, sub-tasks, notes) via the
 * Zustand assignment detail store. Fetches on assignmentId change, subscribes
 * to db:changed events for live updates, and cleans up on unmount.
 *
 * @module @frontend/hooks/useAssignmentDetail
 */

import type { Assignment, EntityId, Note, SubTask } from '@backend/shared/types';
import { useEffect } from 'react';

import {
  useAssignmentDetail as useAssignmentDetailSelector,
  useAssignmentDetailActions,
} from '../stores/assignmentDetailStore';

interface UseAssignmentDetailReturn {
  /** The assignment being viewed (null while loading or if not found) */
  assignment: Assignment | null;
  /** Sub-tasks belonging to the assignment */
  subTasks: SubTask[];
  /** Notes belonging to the assignment */
  notes: Note[];
  /** Whether any fetch operation is in progress */
  isLoading: boolean;
  /** Error message if fetch failed (null if no error) */
  error: string | null;
  /** Whether the assignment was not found */
  notFound: boolean;
  /** Refetches all data for the current assignment */
  refetch: () => Promise<void>;
}

/**
 * Custom hook for loading assignment detail data.
 * Calls fetch on assignmentId change and handles cleanup on unmount.
 *
 * Note: intentionally always fetches when the effect runs (no "already fetched
 * this ID" guard) so that React StrictMode remounts and tab re-visits refetch
 * fresh data — the previous in-flight request is aborted via the store's
 * AbortController regardless.
 *
 * @param assignmentId - The assignment ID to load (from route params)
 */
export function useAssignmentDetail(assignmentId: string): UseAssignmentDetailReturn {
  const { fetch, subscribeToChanges, unsubscribe, reset } = useAssignmentDetailActions();
  const { assignment, subTasks, notes, isLoading, error, notFound, refetch } =
    useAssignmentDetailSelector();

  // Fetch data when assignmentId changes
  useEffect(() => {
    if (!assignmentId) return;
    void fetch(assignmentId as EntityId);
  }, [assignmentId, fetch]);

  // Subscribe to db:changed events for live updates
  useEffect(() => {
    if (assignmentId) {
      subscribeToChanges(assignmentId as EntityId);
    }
    return () => {
      unsubscribe();
    };
  }, [assignmentId, subscribeToChanges, unsubscribe]);

  // Reset store on unmount to prevent state bleed
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return {
    assignment,
    subTasks,
    notes,
    isLoading,
    error,
    notFound,
    refetch,
  };
}