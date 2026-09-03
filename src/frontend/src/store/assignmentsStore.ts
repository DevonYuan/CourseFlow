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
  /** Ordered assignment IDs for priority reordering (drag-and-drop) */
  priorityOrder: string[];
  /** Previous priority order for rollback on error */
  _previousPriorityOrder: string[] | null;
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
  /** Sets the priority order (used for initial load from db:priority:list) */
  setPriorityOrder: (ids: string[]) => void;
  /** Optimistically updates priority order (immediate UI update) */
  reorderOptimistic: (ids: string[]) => void;
  /** Reverts to previous priority order (rollback on IPC error) */
  revertPriorityOrder: () => void;
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
    priorityOrder: [],
    _previousPriorityOrder: null,

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

    setPriorityOrder: (ids: string[]) => {
      set({ priorityOrder: ids });
    },

    reorderOptimistic: (ids: string[]) => {
      // Store current order for potential rollback
      const currentOrder = get().priorityOrder;
      set({ priorityOrder: ids, _previousPriorityOrder: currentOrder });
    },

    revertPriorityOrder: () => {
      const previous = get()._previousPriorityOrder;
      if (previous !== null) {
        set({ priorityOrder: previous, _previousPriorityOrder: null });
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
export const usePriorityOrder = () => useAssignmentsStore((state) => state.priorityOrder);
export const useSetPriorityOrder = () => useAssignmentsStore((state) => state.setPriorityOrder);
export const useReorderOptimistic = () => useAssignmentsStore((state) => state.reorderOptimistic);
export const useRevertPriorityOrder = () => useAssignmentsStore((state) => state.revertPriorityOrder);

/**
 * Initialize the store — fetches assignments.
 * The useAssignments hook handles db:changed event subscription with debouncing.
 * Returns cleanup function (currently no-op, kept for API compatibility).
 */
export function initializeAssignmentsStore(): () => void {
  const store = useAssignmentsStore.getState();
  store.fetchAssignments();
  return () => {};
}