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
export declare const useAssignmentsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AssignmentsStore>>;
/**
 * Selector hooks for common use cases — prevents unnecessary re-renders.
 */
export declare const useAssignments: () => Assignment[];
export declare const useAssignmentsLoading: () => boolean;
export declare const useAssignmentsError: () => string | null;
export declare const useAssignmentsEmpty: () => boolean;
export declare const useSetAssignmentStatus: () => (id: string, status: Assignment["status"]) => void;
/**
 * Initialize the store — fetches assignments.
 * The useAssignments hook handles db:changed event subscription with debouncing.
 * Returns cleanup function (currently no-op, kept for API compatibility).
 */
export declare function initializeAssignmentsStore(): () => void;
export {};
//# sourceMappingURL=assignmentsStore.d.ts.map