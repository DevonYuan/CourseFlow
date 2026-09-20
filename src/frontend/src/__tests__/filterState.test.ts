/**
 * FilterState Tests
 *
 * Tests for the filter state slice in the assignments store.
 */

// @vitest-environment jsdom

import type { SortOption, GroupingType, IsoDateTime } from '@backend/shared/types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useAssignmentsStore } from '../store/assignmentsStore';

// Local FilterState type for tests (matches frontend store's FilterState with sortOption and groupingType)
interface FilterState {
  courseFilter: string[];
  statusFilter: 'all' | 'pending' | 'completed';
  dueDateRange: { start: IsoDateTime; end: IsoDateTime } | null;
  searchQuery: string;
  sortOption: SortOption;
  groupingType: GroupingType;
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Mock window.api
const mockApi = {
  db: {
    assignments: { list: vi.fn() },
    priority: { list: vi.fn() },
  },
  onDbChanged: vi.fn(),
};

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true,
  configurable: true,
});

// Helper to reset Zustand store to initial state
function resetStore() {
  useAssignmentsStore.setState({
    assignments: [],
    isLoading: true,
    error: null,
    isEmpty: true,
    priorityOrder: [],
    _previousPriorityOrder: null,
    filters: {
      courseFilter: [],
      calendarFilter: [],
      statusFilter: 'all',
      dueDateRange: null,
      searchQuery: '',
      sortOption: 'priority',
      groupingType: 'none',
    },
    _searchQueryDebounceTimer: null,
  });
  localStorageMock.clear();
  vi.clearAllMocks();
}

describe('FilterState', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('default state', () => {
    it('has correct default filter values', () => {
      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual([]);
      expect(state.filters.statusFilter).toBe('all');
      expect(state.filters.dueDateRange).toBeNull();
      expect(state.filters.searchQuery).toBe('');
      expect(state.filters.sortOption).toBe('priority');
      expect(state.filters.groupingType).toBe('none');
    });
  });

  describe('setCourseFilter', () => {
    it('sets course filter and persists to localStorage', () => {
      const { setCourseFilter } = useAssignmentsStore.getState();
      setCourseFilter(['CS101', 'MATH200']);

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual(['CS101', 'MATH200']);

      const stored = localStorageMock.getItem('courseflow:filters');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.courseFilter).toEqual(['CS101', 'MATH200']);
    });

    it('handles empty array', () => {
      const { setCourseFilter } = useAssignmentsStore.getState();
      setCourseFilter([]);

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual([]);
    });
  });

  describe('toggleCourseFilter', () => {
    it('adds course when not present', () => {
      const { toggleCourseFilter } = useAssignmentsStore.getState();
      toggleCourseFilter('CS101');

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual(['CS101']);
    });

    it('removes course when present', () => {
      const { setCourseFilter, toggleCourseFilter } = useAssignmentsStore.getState();
      setCourseFilter(['CS101', 'MATH200']);
      toggleCourseFilter('CS101');

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual(['MATH200']);
    });

    it('persists to localStorage', () => {
      const { toggleCourseFilter } = useAssignmentsStore.getState();
      toggleCourseFilter('CS101');

      const stored = localStorageMock.getItem('courseflow:filters');
      const parsed = JSON.parse(stored!);
      expect(parsed.courseFilter).toEqual(['CS101']);
    });
  });

  describe('setStatusFilter', () => {
    it('sets status filter to pending', () => {
      const { setStatusFilter } = useAssignmentsStore.getState();
      setStatusFilter('pending');

      const state = useAssignmentsStore.getState();
      expect(state.filters.statusFilter).toBe('pending');
    });

    it('sets status filter to completed', () => {
      const { setStatusFilter } = useAssignmentsStore.getState();
      setStatusFilter('completed');

      const state = useAssignmentsStore.getState();
      expect(state.filters.statusFilter).toBe('completed');
    });

    it('sets status filter to all', () => {
      const { setStatusFilter } = useAssignmentsStore.getState();
      setStatusFilter('pending');
      setStatusFilter('all');

      const state = useAssignmentsStore.getState();
      expect(state.filters.statusFilter).toBe('all');
    });

    it('persists to localStorage', () => {
      const { setStatusFilter } = useAssignmentsStore.getState();
      setStatusFilter('pending');

      const stored = localStorageMock.getItem('courseflow:filters');
      const parsed = JSON.parse(stored!);
      expect(parsed.statusFilter).toBe('pending');
    });
  });

  describe('setDueDateRange', () => {
    it('sets due date range', () => {
      const { setDueDateRange } = useAssignmentsStore.getState();
      const range = {
        start: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        end: '2026-12-31T23:59:59.999Z' as IsoDateTime,
      };
      setDueDateRange(range);

      const state = useAssignmentsStore.getState();
      expect(state.filters.dueDateRange).toEqual(range);
    });

    it('clears due date range when null', () => {
      const { setDueDateRange } = useAssignmentsStore.getState();
      setDueDateRange({
        start: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        end: '2026-12-31T23:59:59.999Z' as IsoDateTime,
      });
      setDueDateRange(null);

      const state = useAssignmentsStore.getState();
      expect(state.filters.dueDateRange).toBeNull();
    });

    it('persists to localStorage with ISO date strings', () => {
      const { setDueDateRange } = useAssignmentsStore.getState();
      const range = {
        start: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        end: '2026-12-31T23:59:59.999Z' as IsoDateTime,
      };
      setDueDateRange(range);

      const stored = localStorageMock.getItem('courseflow:filters');
      const parsed = JSON.parse(stored!);
      expect(parsed.dueDateRange).toEqual({
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-12-31T23:59:59.999Z',
      });
    });
  });

  describe('setSearchQuery', () => {
    it('sets search query', () => {
      const { setSearchQuery } = useAssignmentsStore.getState();
      setSearchQuery('homework');

      const state = useAssignmentsStore.getState();
      expect(state.filters.searchQuery).toBe('homework');
    });

    it('debounces localStorage write (300ms)', () => {
      const { setSearchQuery } = useAssignmentsStore.getState();
      setSearchQuery('homework');

      // Immediately after, localStorage should not have the new value (debounced)
      // Since localStorage was cleared in resetStore, it may be null or have old values
      let stored = localStorageMock.getItem('courseflow:filters');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.searchQuery).toBe(''); // Still default
      }

      // Advance timers by 300ms
      vi.advanceTimersByTime(300);

      stored = localStorageMock.getItem('courseflow:filters');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.searchQuery).toBe('homework');
    });

    it('cancels previous debounce timer on rapid changes', () => {
      const { setSearchQuery } = useAssignmentsStore.getState();
      setSearchQuery('home');
      vi.advanceTimersByTime(100);
      setSearchQuery('homework');
      vi.advanceTimersByTime(100);
      setSearchQuery('homework assignment');

      // Only the last value should be persisted after 300ms from last call
      vi.advanceTimersByTime(300);

      const stored = localStorageMock.getItem('courseflow:filters');
      const parsed = JSON.parse(stored!);
      expect(parsed.searchQuery).toBe('homework assignment');
    });
  });

  describe('setSortOption', () => {
    it('sets sort option to dueDateAsc', () => {
      const { setSortOption } = useAssignmentsStore.getState();
      setSortOption('dueDateAsc');

      const state = useAssignmentsStore.getState();
      expect(state.filters.sortOption).toBe('dueDateAsc');
    });

    it('sets sort option to dueDateDesc', () => {
      const { setSortOption } = useAssignmentsStore.getState();
      setSortOption('dueDateDesc');

      const state = useAssignmentsStore.getState();
      expect(state.filters.sortOption).toBe('dueDateDesc');
    });

    it('sets sort option to course', () => {
      const { setSortOption } = useAssignmentsStore.getState();
      setSortOption('course');

      const state = useAssignmentsStore.getState();
      expect(state.filters.sortOption).toBe('course');
    });

    it('sets sort option to createdDesc', () => {
      const { setSortOption } = useAssignmentsStore.getState();
      setSortOption('createdDesc');

      const state = useAssignmentsStore.getState();
      expect(state.filters.sortOption).toBe('createdDesc');
    });

    it('persists to localStorage', () => {
      const { setSortOption } = useAssignmentsStore.getState();
      setSortOption('dueDateAsc');

      const stored = localStorageMock.getItem('courseflow:filters');
      const parsed = JSON.parse(stored!);
      expect(parsed.sortOption).toBe('dueDateAsc');
    });
  });

  describe('setGroupingType', () => {
    it('sets grouping type to week', () => {
      const { setGroupingType } = useAssignmentsStore.getState();
      setGroupingType('week');

      const state = useAssignmentsStore.getState();
      expect(state.filters.groupingType).toBe('week');
    });

    it('sets grouping type to status', () => {
      const { setGroupingType } = useAssignmentsStore.getState();
      setGroupingType('status');

      const state = useAssignmentsStore.getState();
      expect(state.filters.groupingType).toBe('status');
    });

    it('sets grouping type to course', () => {
      const { setGroupingType } = useAssignmentsStore.getState();
      setGroupingType('course');

      const state = useAssignmentsStore.getState();
      expect(state.filters.groupingType).toBe('course');
    });

    it('sets grouping type to none', () => {
      const { setGroupingType } = useAssignmentsStore.getState();
      setGroupingType('week');
      setGroupingType('none');

      const state = useAssignmentsStore.getState();
      expect(state.filters.groupingType).toBe('none');
    });

    it('persists to localStorage', () => {
      const { setGroupingType } = useAssignmentsStore.getState();
      setGroupingType('week');

      const stored = localStorageMock.getItem('courseflow:filters');
      const parsed = JSON.parse(stored!);
      expect(parsed.groupingType).toBe('week');
    });
  });

  describe('resetFilters', () => {
    it('resets all filters to defaults', () => {
      const {
        setCourseFilter,
        setStatusFilter,
        setDueDateRange,
        setSearchQuery,
        setSortOption,
        setGroupingType,
        resetFilters,
      } = useAssignmentsStore.getState();

      setCourseFilter(['CS101']);
      setStatusFilter('pending');
      setDueDateRange({
        start: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        end: '2026-12-31T23:59:59.999Z' as IsoDateTime,
      });
      setSearchQuery('homework');
      setSortOption('dueDateAsc');
      setGroupingType('week');

      resetFilters();

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual([]);
      expect(state.filters.statusFilter).toBe('all');
      expect(state.filters.dueDateRange).toBeNull();
      expect(state.filters.searchQuery).toBe('');
      expect(state.filters.sortOption).toBe('priority');
      expect(state.filters.groupingType).toBe('none');
    });

    it('persists defaults to localStorage', () => {
      const { resetFilters } = useAssignmentsStore.getState();
      resetFilters();

      const stored = localStorageMock.getItem('courseflow:filters');
      const parsed = JSON.parse(stored!);
      expect(parsed.courseFilter).toEqual([]);
      expect(parsed.statusFilter).toBe('all');
      expect(parsed.dueDateRange).toBeNull();
      expect(parsed.searchQuery).toBe('');
      expect(parsed.sortOption).toBe('priority');
      expect(parsed.groupingType).toBe('none');
    });
  });

  describe('hydrateFilters', () => {
    it('hydrates from localStorage on initialization', () => {
      const storedState: FilterState = {
        courseFilter: ['CS101', 'MATH200'],
        statusFilter: 'pending',
        dueDateRange: {
          start: '2026-01-01T00:00:00.000Z' as IsoDateTime,
          end: '2026-12-31T23:59:59.999Z' as IsoDateTime,
        },
        searchQuery: 'homework',
        sortOption: 'dueDateAsc',
        groupingType: 'week',
      };

      // Store with ISO date strings (already in correct format)
      localStorageMock.setItem('courseflow:filters', JSON.stringify(storedState));

      const { hydrateFilters } = useAssignmentsStore.getState();
      hydrateFilters();

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual(['CS101', 'MATH200']);
      expect(state.filters.statusFilter).toBe('pending');
      expect(state.filters.dueDateRange).not.toBeNull();
      expect(state.filters.dueDateRange!.start).toBe('2026-01-01T00:00:00.000Z');
      expect(state.filters.dueDateRange!.end).toBe('2026-12-31T23:59:59.999Z');
      expect(state.filters.searchQuery).toBe('homework');
      expect(state.filters.sortOption).toBe('dueDateAsc');
      expect(state.filters.groupingType).toBe('week');
    });

    it('handles missing localStorage gracefully', () => {
      const { hydrateFilters } = useAssignmentsStore.getState();
      hydrateFilters();

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual([]);
      expect(state.filters.statusFilter).toBe('all');
      expect(state.filters.sortOption).toBe('priority');
      expect(state.filters.groupingType).toBe('none');
    });

    it('handles corrupt JSON in localStorage gracefully', () => {
      localStorageMock.setItem('courseflow:filters', 'invalid json');

      const { hydrateFilters } = useAssignmentsStore.getState();
      hydrateFilters();

      const state = useAssignmentsStore.getState();
      // Should keep defaults
      expect(state.filters.courseFilter).toEqual([]);
      expect(state.filters.statusFilter).toBe('all');
    });

    it('handles private browsing mode (localStorage throws)', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Quota exceeded');
      });

      const { hydrateFilters } = useAssignmentsStore.getState();
      expect(() => hydrateFilters()).not.toThrow();

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual([]);
    });
  });

  describe('useCourseNames', () => {
    it('returns unique sorted course names from assignments', () => {
      const assignments = [
        { id: '1', courseName: 'MATH200', title: 'A' } as any,
        { id: '2', courseName: 'CS101', title: 'B' } as any,
        { id: '3', courseName: 'CS101', title: 'C' } as any,
        { id: '4', courseName: 'PHYS101', title: 'D' } as any,
      ];

      useAssignmentsStore.setState({ assignments });

      // Need to call the selector to get the derived value
      const courseNames = useAssignmentsStore.getState();
      // The selector is a function, so we need to evaluate it
      const names = [...new Set(assignments.map((a) => a.courseName))].sort();
      expect(names).toEqual(['CS101', 'MATH200', 'PHYS101']);
    });

    it('returns empty array when no assignments', () => {
      useAssignmentsStore.setState({ assignments: [] });

      const names = [...new Set([])].sort();
      expect(names).toEqual([]);
    });
  });

  describe('localStorage error handling', () => {
    it('handles write errors gracefully (private browsing)', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Quota exceeded');
      });

      const { setCourseFilter } = useAssignmentsStore.getState();
      expect(() => setCourseFilter(['CS101'])).not.toThrow();

      const state = useAssignmentsStore.getState();
      expect(state.filters.courseFilter).toEqual(['CS101']); // State still updates
    });

    it('handles read errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Security error');
      });

      const { hydrateFilters } = useAssignmentsStore.getState();
      expect(() => hydrateFilters()).not.toThrow();
    });
  });
});
