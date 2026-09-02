/**
 * useAssignments Hook — Assignment Data Fetching & State Management
 *
 * Fetches assignments from the backend via IPC, handles loading/error/empty states,
 * and provides retry functionality. Subscribes to db:changed events to auto-refresh
 * with debouncing. Uses Zustand store's memoized selector hooks for optimal performance.
 *
 * @module @frontend/hooks/useAssignments
 */
import type { Assignment } from '@backend/shared/types';
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
export declare function useAssignments(): UseAssignmentsReturn;
export {};
//# sourceMappingURL=useAssignments.d.ts.map