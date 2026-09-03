/**
 * Assignments Store — Zustand
 *
 * Centralized state management for assignments with IPC synchronization.
 * Handles fetching, caching, and real-time updates via db:changed events.
 *
 * @module @frontend/store/assignmentsStore
 */

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, PriorityOrder, SortOption, GroupingType } from '@backend/shared/types';
import { create } from 'zustand';

import { mapErrorToMessage } from '../utils/errorMessages';

/**
 * Filter state for assignment list — persisted to localStorage.
 * Includes course filter, status filter, date range, search, sort, and grouping.
 */
export interface FilterState {
  /** Course names to include (empty = all) */
  courseFilter: string[];
  /** Status filter: all, pending, or completed */
  statusFilter: 'all' | 'pending' | 'completed';
  /** Optional date range filter for due dates */
  dueDateRange: { start: Date; end: Date } | null;
  /** Search query string */
  searchQuery: string;
  /** Sort option for assignment list */
  sortOption: SortOption;
  /** Grouping type for assignment list */
  groupingType: GroupingType;
}

/** Default filter state values */
const defaultFilterState: FilterState = {
  courseFilter: [],
  statusFilter: 'all',
  dueDateRange: null,
  searchQuery: '',
  sortOption: 'priority',
  groupingType: 'none',
};

/** localStorage key for filter persistence */
const FILTER_STORAGE_KEY = 'courseflow:filters';

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
  /** Filter state for assignment list */
  filters: FilterState;
  /** Internal: timer ID for debounced search query persistence */
  _searchQueryDebounceTimer: ReturnType<typeof setTimeout> | number | null;
}

interface AssignmentsActions {
  /** Triggers a fresh fetch of assignments from the database */
  fetchAssignments: () => Promise<void>;
  /** Hydrates store with assignments and priority order (used on app startup) */
  hydrate: (assignments: Assignment[], priorityOrder: PriorityOrder[]) => void;
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
  /**
   * Moves an assignment in the priority order.
   * @param assignmentId - The ID of the assignment to move
   * @param direction - Direction to move: 'up' | 'down' | 'top' | 'bottom'
   * @returns Object with newIndex (position after move) and total (total movable items), or null if move not possible
   */
  moveAssignment: (assignmentId: string, direction: 'up' | 'down' | 'top' | 'bottom') => { newIndex: number; total: number } | null;

  // Filter actions
  /** Sets the course filter (multi-select) */
  setCourseFilter: (courses: string[]) => void;
  /** Toggles a course in the filter */
  toggleCourseFilter: (course: string) => void;
  /** Sets the status filter */
  setStatusFilter: (status: FilterState['statusFilter']) => void;
  /** Sets the due date range filter */
  setDueDateRange: (range: FilterState['dueDateRange']) => void;
  /** Sets the search query (debounced persistence) */
  setSearchQuery: (query: string) => void;
  /** Sets the sort option */
  setSortOption: (option: SortOption) => void;
  /** Sets the grouping type */
  setGroupingType: (type: GroupingType) => void;
  /** Resets all filters to defaults */
  resetFilters: () => void;
  /** Hydrates filter state from localStorage (called on initialization) */
  hydrateFilters: () => void;
}

type AssignmentsStore = AssignmentsState & AssignmentsActions;

/**
 * Safely reads filter state from localStorage.
 * Handles private browsing, quota exceeded, and corrupt JSON.
 */
function readFiltersFromStorage(): FilterState | null {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<FilterState> & { dueDateRange?: { start: string; end: string } | null };
    // Convert date strings back to Date objects
    if (parsed.dueDateRange && parsed.dueDateRange.start && parsed.dueDateRange.end) {
      return {
        ...defaultFilterState,
        ...parsed,
        dueDateRange: {
          start: new Date(parsed.dueDateRange.start),
          end: new Date(parsed.dueDateRange.end),
        },
      } as FilterState;
    }
    return { ...defaultFilterState, ...parsed } as FilterState;
  } catch {
    // Ignore errors (private browsing, quota, corrupt JSON)
    return null;
  }
}

/**
 * Safely writes filter state to localStorage.
 * Handles private browsing and quota exceeded.
 */
function writeFiltersToStorage(filters: FilterState): void {
  try {
    const toStore = {
      ...filters,
      dueDateRange: filters.dueDateRange
        ? { start: filters.dueDateRange.start.toISOString(), end: filters.dueDateRange.end.toISOString() }
        : null,
    };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore errors (private browsing, quota exceeded)
  }
}

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
    filters: defaultFilterState,
    _searchQueryDebounceTimer: null,

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

    hydrate: (assignments: Assignment[], priorityOrder: PriorityOrder[]) => {
      // Sort priorityOrder by position to get the correct order
      const sortedPriorityOrder = [...priorityOrder].sort((a, b) => a.order - b.order);
      const priorityIds = sortedPriorityOrder.map((po) => po.assignmentId);
      set({
        assignments,
        priorityOrder: priorityIds,
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

    moveAssignment: (assignmentId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      const { assignments, priorityOrder } = get();

      // Get the list of movable assignment IDs (exclude completed)
      // Use priorityOrder if available, otherwise use assignments order
      const baseOrder = priorityOrder.length > 0 ? priorityOrder : assignments.map((a) => a.id);
      const movableIds = baseOrder.filter((id) => {
        const assignment = assignments.find((a) => a.id === id);
        return assignment && assignment.status !== 'completed';
      });

      const currentIndex = movableIds.indexOf(assignmentId);
      if (currentIndex === -1) {
        return null; // Assignment not found or is completed
      }

      let newIndex: number;
      switch (direction) {
        case 'up':
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'down':
          newIndex = Math.min(movableIds.length - 1, currentIndex + 1);
          break;
        case 'top':
          newIndex = 0;
          break;
        case 'bottom':
          newIndex = movableIds.length - 1;
          break;
      }

      if (newIndex === currentIndex) {
        return null; // No change
      }

      // Create new order by moving the item
      const newMovableIds = [...movableIds];
      const [movedId] = newMovableIds.splice(currentIndex, 1);
      newMovableIds.splice(newIndex, 0, movedId);

      // Merge back with non-movable items (completed assignments)
      // Completed assignments stay in their relative positions at the end
      const completedIds = baseOrder.filter((id) => !movableIds.includes(id));
      const newOrder = [...newMovableIds, ...completedIds];

      // Optimistic update
      get().reorderOptimistic(newOrder);

      return { newIndex, total: movableIds.length };
    },

    // Filter actions
    setCourseFilter: (courses: string[]) => {
      set((state) => {
        const newFilters = { ...state.filters, courseFilter: courses };
        writeFiltersToStorage(newFilters);
        return { filters: newFilters };
      });
    },

    toggleCourseFilter: (course: string) => {
      set((state) => {
        const current = state.filters.courseFilter;
        const newCourseFilter = current.includes(course)
          ? current.filter((c) => c !== course)
          : [...current, course];
        const newFilters = { ...state.filters, courseFilter: newCourseFilter };
        writeFiltersToStorage(newFilters);
        return { filters: newFilters };
      });
    },

    setStatusFilter: (status: FilterState['statusFilter']) => {
      set((state) => {
        const newFilters = { ...state.filters, statusFilter: status };
        writeFiltersToStorage(newFilters);
        return { filters: newFilters };
      });
    },

    setDueDateRange: (range: FilterState['dueDateRange']) => {
      set((state) => {
        const newFilters = { ...state.filters, dueDateRange: range };
        writeFiltersToStorage(newFilters);
        return { filters: newFilters };
      });
    },

    setSearchQuery: (query: string) => {
      set((state) => {
        const newFilters = { ...state.filters, searchQuery: query };
        // Debounce search query persistence (300ms)
        if (state._searchQueryDebounceTimer) {
          clearTimeout(state._searchQueryDebounceTimer);
        }
        const timer = window.setTimeout(() => {
          writeFiltersToStorage(newFilters);
        }, 300);
        return { filters: newFilters, _searchQueryDebounceTimer: timer };
      });
    },

    setSortOption: (option: SortOption) => {
      set((state) => {
        const newFilters = { ...state.filters, sortOption: option };
        writeFiltersToStorage(newFilters);
        return { filters: newFilters };
      });
    },

    setGroupingType: (type: GroupingType) => {
      set((state) => {
        const newFilters = { ...state.filters, groupingType: type };
        writeFiltersToStorage(newFilters);
        return { filters: newFilters };
      });
    },

    resetFilters: () => {
      set((_state) => {
        writeFiltersToStorage(defaultFilterState);
        return { filters: defaultFilterState };
      });
    },

    hydrateFilters: () => {
      const stored = readFiltersFromStorage();
      if (stored) {
        set({ filters: stored });
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
export const useMoveAssignment = () => useAssignmentsStore((state) => state.moveAssignment);
export const useHydrate = () => useAssignmentsStore((state) => state.hydrate);

// Filter selector hooks
export const useFilters = () => useAssignmentsStore((state) => state.filters);
export const useCourseFilter = () => useAssignmentsStore((state) => state.filters.courseFilter);
export const useStatusFilter = () => useAssignmentsStore((state) => state.filters.statusFilter);
export const useDueDateRange = () => useAssignmentsStore((state) => state.filters.dueDateRange);
export const useSearchQuery = () => useAssignmentsStore((state) => state.filters.searchQuery);
export const useSortOption = () => useAssignmentsStore((state) => state.filters.sortOption);
export const useGroupingType = () => useAssignmentsStore((state) => state.filters.groupingType);
export const useSetCourseFilter = () => useAssignmentsStore((state) => state.setCourseFilter);
export const useToggleCourseFilter = () => useAssignmentsStore((state) => state.toggleCourseFilter);
export const useSetStatusFilter = () => useAssignmentsStore((state) => state.setStatusFilter);
export const useSetDueDateRange = () => useAssignmentsStore((state) => state.setDueDateRange);
export const useSetSearchQuery = () => useAssignmentsStore((state) => state.setSearchQuery);
export const useSetSortOption = () => useAssignmentsStore((state) => state.setSortOption);
export const useSetGroupingType = () => useAssignmentsStore((state) => state.setGroupingType);
export const useResetFilters = () => useAssignmentsStore((state) => state.resetFilters);
export const useHydrateFilters = () => useAssignmentsStore((state) => state.hydrateFilters);

/**
 * Derived selector: unique course names from assignments for filter options.
 * Returns sorted array of unique course names.
 */
export const useCourseNames = () =>
  useAssignmentsStore((state) => {
    const names = new Set(state.assignments.map((a) => a.courseName));
    return [...names].sort();
  });

/**
 * Initialize the store — fetches assignments and priority order.
 * The useAssignments hook handles db:changed event subscription with debouncing.
 * Returns cleanup function (currently no-op, kept for API compatibility).
 */
export function initializeAssignmentsStore(): () => void {
  const store = useAssignmentsStore.getState();

  // Hydrate filter state from localStorage
  store.hydrateFilters();

  // Fetch both assignments and priority order in parallel, then hydrate
  Promise.all([
    window.api.db.assignments.list(),
    window.api.db.priority.list(),
  ]).then(([assignmentsResult, priorityResult]) => {
    if (assignmentsResult.ok && priorityResult.ok) {
      store.hydrate(assignmentsResult.data, priorityResult.data);
    } else if (assignmentsResult.ok) {
      // Fallback: if priority fetch fails, just set assignments
      store.setAssignments(assignmentsResult.data);
    } else {
      // Error fetching assignments
      const error = new Error(assignmentsResult.error);
      error.name = assignmentsResult.code || 'UNKNOWN_ERROR';
      const errorMessage = mapErrorToMessage(error);
      useAssignmentsStore.setState({ assignments: [], priorityOrder: [], isLoading: false, error: errorMessage, isEmpty: true });
    }
  }).catch((err) => {
    const errorMessage = mapErrorToMessage(err);
    useAssignmentsStore.setState({ assignments: [], priorityOrder: [], isLoading: false, error: errorMessage, isEmpty: true });
  });

  return () => {};
}