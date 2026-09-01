/**
 * Assignments Store — Zustand
 *
 * Centralized state management for assignments with IPC synchronization.
 * Handles fetching, caching, and real-time updates via db:changed events.
 *
 * @module @frontend/store/assignmentsStore
 */

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment } from '@backend/shared/types';
import { create } from 'zustand';

import { mapErrorToMessage } from '../utils/errorMessages';

interface AssignmentsState {
  /** Current list of assignments */
  assignments: Assignment[];
  /** Whether a fetch operation is in progress */
  isLoading: boolean;
  /** Error message if fetch failed (null if no error) */
  error: string | null;
  /** Whether the list is empty (no assignments and not loading) */
  isEmpty: boolean;
}

interface AssignmentsActions {
  /** Triggers a fresh fetch of assignments from the database */
  fetchAssignments: () => Promise<void>;
  /** Sets assignments directly (used for initial load or external updates) */
  setAssignments: (assignments: Assignment[]) => void;
  /** Updates the status of a single assignment (optimistic update) */
  setAssignmentStatus: (id: string, status: Assignment['status']) => void;
  /** Clears the current error state */
  clearError: () => void;
  /** Handles db:changed event payload */
  handleDbChanged: (payload: IpcEvents['db:changed']) => void;
}

type AssignmentsStore = AssignmentsState & AssignmentsActions;

/**
 * Zustand store for assignment list state.
 */
export const useAssignmentsStore = create<AssignmentsStore>()((set, get) => ({
    // Initial state
    assignments: [],
    isLoading: true,
    error: null,
    isEmpty: true,

    // Actions
    fetchAssignments: async () => {
      // Always set loading state at start (allows re-fetching)
      set({ isLoading: true, error: null });

      try {
        const result = await window.api.db.assignments.list();

        if (result.ok) {
          const assignments = result.data;
          set({
            assignments,
            isLoading: false,
            error: null,
            isEmpty: assignments.length === 0,
          });
        } else {
          // Create an error object with the IPC error code as the name
          // so mapErrorToMessage can map it to a user-friendly message
          const error = new Error(result.error);
          error.name = result.code || 'UNKNOWN_ERROR';
          const errorMessage = mapErrorToMessage(error);
          set({
            assignments: [],
            isLoading: false,
            error: errorMessage,
            isEmpty: true,
          });
        }
      } catch (err) {
        const errorMessage = mapErrorToMessage(err);
        set({
          assignments: [],
          isLoading: false,
          error: errorMessage,
          isEmpty: true,
        });
      }
    },

    setAssignments: (assignments: Assignment[]) => {
      set({
        assignments,
        isLoading: false,
        error: null,
        isEmpty: assignments.length === 0,
      });
    },

    clearError: () => {
      set({ error: null });
    },

    setAssignmentStatus: (id: string, status: Assignment['status']) => {
      set((state) => ({
        assignments: state.assignments.map((assignment) =>
          assignment.id === id ? { ...assignment, status } : assignment
        ),
      }));
    },

    handleDbChanged: (payload: IpcEvents['db:changed']) => {
      if (payload.table === 'assignments') {
        // Re-fetch on any assignment change
        get().fetchAssignments();
      }
    },
  })
);

/**
 * Selector hooks for common use cases — prevents unnecessary re-renders.
 */
export const useAssignments = () => useAssignmentsStore((state) => state.assignments);
export const useAssignmentsLoading = () => useAssignmentsStore((state) => state.isLoading);
export const useAssignmentsError = () => useAssignmentsStore((state) => state.error);
export const useAssignmentsEmpty = () => useAssignmentsStore((state) => state.isEmpty);
export const useSetAssignmentStatus = () => useAssignmentsStore((state) => state.setAssignmentStatus);

/**
 * Subscribe to db:changed events.
 * Call this once during app initialization.
 */
export function subscribeToDbChanges(): () => void {
  const unsubscribe = window.api.onDbChanged((payload: IpcEvents['db:changed']) => {
    useAssignmentsStore.getState().handleDbChanged(payload);
  });
  return unsubscribe;
}

/**
 * Initialize the store — fetches assignments and sets up event subscription.
 * Returns cleanup function.
 */
export function initializeAssignmentsStore(): () => void {
  const store = useAssignmentsStore.getState();
  store.fetchAssignments();
  const unsubscribe = subscribeToDbChanges();
  return unsubscribe;
}