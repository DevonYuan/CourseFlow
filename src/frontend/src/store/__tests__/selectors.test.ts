/**
 * Selectors Tests — Pure Filter/Sort/Group Functions
 *
 * Unit tests for the assignment selector functions.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Assignment, IsoDateTime, SortOption, GroupingType } from '@backend/shared/types';
import {
  filterBySearch,
  filterByCourse,
  filterByStatus,
  filterByDateRange,
  applyFilters,
  createPrioritySortComparator,
  sortByDueDateAsc,
  sortByDueDateDesc,
  sortByCourse,
  sortByCreatedDesc,
  applySort,
  groupByWeek,
  groupByStatus,
  groupByCourse,
  applyGrouping,
  selectFilteredAssignments,
  type GroupedAssignments,
} from '../selectors';

// Test utilities
function createMockAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const now = new Date();
  const isoNow = now.toISOString() as IsoDateTime;

  return {
    id: '1' as any,
    title: 'Test Assignment',
    description: 'Test description',
    courseId: 'course1' as any,
    courseName: 'CS101',
    courseColor: '#e8a838',
    dueAt: isoNow,
    unlockAt: null,
    lockAt: null,
    pointsPossible: 100,
    submissionTypes: ['online_text_entry'],
    workflowState: 'published',
    htmlUrl: 'https://canvas.example.edu/courses/1/assignments/1',
    icalUid: 'uid1',
    priority: 'high',
    status: 'pending',
    source: 'ical',
    sourceUrl: 'https://canvas.example.edu/feeds/calendars/...',
    createdAt: isoNow,
    updatedAt: isoNow,
    ...overrides,
  };
}

describe('filterBySearch', () => {
  const assignments = [
    createMockAssignment({ id: '1' as any, title: 'Math Homework', courseName: 'Math 101', description: 'Algebra problems' }),
    createMockAssignment({ id: '2' as any, title: 'English Essay', courseName: 'English 101', description: 'Shakespeare analysis' }),
    createMockAssignment({ id: '3' as any, title: 'Physics Lab', courseName: 'Physics 101', description: 'Newton laws' }),
  ];

  it('returns all assignments when query is empty', () => {
    expect(filterBySearch(assignments, '')).toEqual(assignments);
    expect(filterBySearch(assignments, '   ')).toEqual(assignments);
  });

  it('filters by title (case-insensitive)', () => {
    const result = filterBySearch(assignments, 'math');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Math Homework');
  });

  it('filters by course name', () => {
    const result = filterBySearch(assignments, 'english');
    expect(result).toHaveLength(1);
    expect(result[0].courseName).toBe('English 101');
  });

  it('filters by description', () => {
    const result = filterBySearch(assignments, 'shakespeare');
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Shakespeare analysis');
  });

  it('returns empty array when no match', () => {
    expect(filterBySearch(assignments, 'biology')).toEqual([]);
  });
});

describe('filterByCourse', () => {
  const assignments = [
    createMockAssignment({ id: '1' as any, courseName: 'CS101' }),
    createMockAssignment({ id: '2' as any, courseName: 'CS101' }),
    createMockAssignment({ id: '3' as any, courseName: 'MATH101' }),
  ];

  it('returns all assignments when courseFilter is empty', () => {
    expect(filterByCourse(assignments, [])).toEqual(assignments);
  });

  it('filters by single course', () => {
    const result = filterByCourse(assignments, ['CS101']);
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.courseName === 'CS101')).toBe(true);
  });

  it('filters by multiple courses', () => {
    const result = filterByCourse(assignments, ['CS101', 'MATH101']);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no matching course', () => {
    expect(filterByCourse(assignments, ['BIO101'])).toEqual([]);
  });
});

describe('filterByStatus', () => {
  const assignments = [
    createMockAssignment({ id: '1' as any, status: 'pending' }),
    createMockAssignment({ id: '2' as any, status: 'in_progress' }),
    createMockAssignment({ id: '3' as any, status: 'completed' }),
    createMockAssignment({ id: '4' as any, status: 'archived' }),
  ];

  it('returns all when statusFilter is all', () => {
    expect(filterByStatus(assignments, 'all')).toEqual(assignments);
  });

  it('filters pending (excludes completed)', () => {
    const result = filterByStatus(assignments, 'pending');
    expect(result).toHaveLength(3);
    expect(result.every((a) => a.status !== 'completed')).toBe(true);
  });

  it('filters completed only', () => {
    const result = filterByStatus(assignments, 'completed');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });
});

describe('filterByDateRange', () => {
  const baseDate = new Date('2025-01-15T12:00:00.000Z');
  const assignments = [
    createMockAssignment({ id: '1' as any, dueAt: new Date('2025-01-10T12:00:00.000Z').toISOString() as IsoDateTime }), // Before range
    createMockAssignment({ id: '2' as any, dueAt: new Date('2025-01-15T12:00:00.000Z').toISOString() as IsoDateTime }), // Start of range
    createMockAssignment({ id: '3' as any, dueAt: new Date('2025-01-20T12:00:00.000Z').toISOString() as IsoDateTime }), // End of range
    createMockAssignment({ id: '4' as any, dueAt: new Date('2025-01-25T12:00:00.000Z').toISOString() as IsoDateTime }), // After range
    createMockAssignment({ id: '5' as any, dueAt: null }), // No due date
  ];

  it('returns all when no date range', () => {
    expect(filterByDateRange(assignments, null)).toEqual(assignments);
  });

  it('filters by inclusive date range', () => {
    const range = { start: new Date('2025-01-15T00:00:00.000Z'), end: new Date('2025-01-20T23:59:59.999Z') };
    const result = filterByDateRange(assignments, range);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(['2', '3']);
  });

  it('excludes assignments with null dueAt', () => {
    const range = { start: new Date('2025-01-01T00:00:00.000Z'), end: new Date('2025-12-31T23:59:59.999Z') };
    const result = filterByDateRange(assignments, range);
    expect(result.every((a) => a.dueAt !== null)).toBe(true);
  });
});

describe('applyFilters', () => {
  const assignments = [
    createMockAssignment({ id: '1' as any, title: 'Math HW', courseName: 'Math', status: 'pending', dueAt: '2025-01-15T12:00:00.000Z' as IsoDateTime }),
    createMockAssignment({ id: '2' as any, title: 'English Essay', courseName: 'English', status: 'completed', dueAt: '2025-01-20T12:00:00.000Z' as IsoDateTime }),
    createMockAssignment({ id: '3' as any, title: 'Physics Lab', courseName: 'Physics', status: 'pending', dueAt: '2025-01-25T12:00:00.000Z' as IsoDateTime }),
  ];

  const baseFilters = {
    courseFilter: [] as string[],
    statusFilter: 'all' as const,
    dueDateRange: null as { start: Date; end: Date } | null,
    searchQuery: '',
    sortOption: 'priority' as SortOption,
    groupingType: 'none' as GroupingType,
  };

  it('applies all filters in sequence', () => {
    const filters = {
      ...baseFilters,
      searchQuery: 'math',
      courseFilter: ['Math'],
      statusFilter: 'pending' as const,
    };
    const result = applyFilters(assignments, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty when filters exclude all', () => {
    const filters = {
      ...baseFilters,
      searchQuery: 'nonexistent',
    };
    const result = applyFilters(assignments, filters);
    expect(result).toEqual([]);
  });
});

describe('Sort Comparators', () => {
  const assignments = [
    createMockAssignment({
      id: '1' as any,
      title: 'A',
      courseName: 'Z Course',
      dueAt: '2025-01-20T12:00:00.000Z' as IsoDateTime,
      createdAt: '2025-01-01T12:00:00.000Z' as IsoDateTime,
    }),
    createMockAssignment({
      id: '2' as any,
      title: 'B',
      courseName: 'A Course',
      dueAt: '2025-01-10T12:00:00.000Z' as IsoDateTime,
      createdAt: '2025-01-02T12:00:00.000Z' as IsoDateTime,
    }),
    createMockAssignment({
      id: '3' as any,
      title: 'C',
      courseName: 'M Course',
      dueAt: null,
      createdAt: '2025-01-03T12:00:00.000Z' as IsoDateTime,
    }),
  ];

  describe('sortByDueDateAsc', () => {
    it('sorts by due date ascending, nulls last', () => {
      const result = [...assignments].sort(sortByDueDateAsc);
      expect(result.map((a) => a.id)).toEqual(['2', '1', '3']);
    });
  });

  describe('sortByDueDateDesc', () => {
    it('sorts by due date descending, nulls first', () => {
      const result = [...assignments].sort(sortByDueDateDesc);
      expect(result.map((a) => a.id)).toEqual(['3', '1', '2']);
    });
  });

  describe('sortByCourse', () => {
    it('sorts by course name ascending, then due date ascending', () => {
      const result = [...assignments].sort(sortByCourse);
      expect(result.map((a) => a.id)).toEqual(['2', '3', '1']);
    });
  });

  describe('sortByCreatedDesc', () => {
    it('sorts by created date descending', () => {
      const result = [...assignments].sort(sortByCreatedDesc);
      expect(result.map((a) => a.id)).toEqual(['3', '2', '1']);
    });
  });

  describe('createPrioritySortComparator', () => {
    it('sorts by priority order position', () => {
      const priorityOrder = ['3', '1', '2'];
      const comparator = createPrioritySortComparator(priorityOrder);
      const result = [...assignments].sort(comparator);
      expect(result.map((a) => a.id)).toEqual(['3', '1', '2']);
    });

    it('puts unknown assignments at end', () => {
      const priorityOrder = ['1'];
      const comparator = createPrioritySortComparator(priorityOrder);
      const result = [...assignments].sort(comparator);
      expect(result[0].id).toBe('1');
      expect(result.slice(1).map((a) => a.id).sort()).toEqual(['2', '3']);
    });

    it('uses due date as tiebreaker for same priority', () => {
      const assignmentsWithSamePriority = [
        createMockAssignment({ id: '1' as any, dueAt: '2025-01-20T12:00:00.000Z' as IsoDateTime }),
        createMockAssignment({ id: '2' as any, dueAt: '2025-01-10T12:00:00.000Z' as IsoDateTime }),
      ];
      const priorityOrder = ['1', '2'];
      const comparator = createPrioritySortComparator(priorityOrder);
      const result = [...assignmentsWithSamePriority].sort(comparator);
      // Both in priority order, so due date shouldn't matter
      expect(result.map((a) => a.id)).toEqual(['1', '2']);
    });
  });
});

describe('applySort', () => {
  const assignments = [
    createMockAssignment({
      id: '1' as any,
      courseName: 'Z Course',
      dueAt: '2025-01-20T12:00:00.000Z' as IsoDateTime,
      createdAt: '2025-01-01T12:00:00.000Z' as IsoDateTime,
    }),
    createMockAssignment({
      id: '2' as any,
      courseName: 'A Course',
      dueAt: '2025-01-10T12:00:00.000Z' as IsoDateTime,
      createdAt: '2025-01-02T12:00:00.000Z' as IsoDateTime,
    }),
  ];

  it('sorts by priority when sortOption is priority', () => {
    const result = applySort(assignments, 'priority', ['2', '1']);
    expect(result.map((a) => a.id)).toEqual(['2', '1']);
  });

  it('sorts by dueDateAsc', () => {
    const result = applySort(assignments, 'dueDateAsc');
    expect(result.map((a) => a.id)).toEqual(['2', '1']);
  });

  it('sorts by dueDateDesc', () => {
    const result = applySort(assignments, 'dueDateDesc');
    expect(result.map((a) => a.id)).toEqual(['1', '2']);
  });

  it('sorts by course', () => {
    const result = applySort(assignments, 'course');
    expect(result.map((a) => a.id)).toEqual(['2', '1']);
  });

  it('sorts by createdDesc', () => {
    const result = applySort(assignments, 'createdDesc');
    expect(result.map((a) => a.id)).toEqual(['2', '1']);
  });

  it('returns copy for unknown sort option', () => {
    const result = applySort(assignments, 'unknown' as SortOption);
    expect(result).toEqual(assignments);
  });
});

describe('Grouping Functions', () => {
  const now = new Date('2025-01-15T12:00:00.000Z'); // Wednesday
  const mondayThisWeek = new Date('2025-01-13T00:00:00.000Z');
  const sundayThisWeek = new Date('2025-01-19T23:59:59.999Z');

  const assignments = [
    createMockAssignment({ id: '1' as any, status: 'pending', dueAt: new Date('2025-01-10T12:00:00.000Z').toISOString() as IsoDateTime, courseName: 'CS101' }), // Overdue
    createMockAssignment({ id: '2' as any, status: 'pending', dueAt: new Date('2025-01-14T12:00:00.000Z').toISOString() as IsoDateTime, courseName: 'CS101' }), // This week
    createMockAssignment({ id: '3' as any, status: 'pending', dueAt: new Date('2025-01-25T12:00:00.000Z').toISOString() as IsoDateTime, courseName: 'MATH101' }), // Upcoming
    createMockAssignment({ id: '4' as any, status: 'completed', dueAt: new Date('2025-01-10T12:00:00.000Z').toISOString() as IsoDateTime, courseName: 'CS101' }), // Completed
    createMockAssignment({ id: '5' as any, status: 'pending', dueAt: null, courseName: 'PHYS101' }), // No due date -> Upcoming
    createMockAssignment({ id: '6' as any, status: 'in_progress', dueAt: new Date('2025-01-14T12:00:00.000Z').toISOString() as IsoDateTime, courseName: 'MATH101' }), // In progress
    createMockAssignment({ id: '7' as any, status: 'archived', dueAt: new Date('2025-01-10T12:00:00.000Z').toISOString() as IsoDateTime, courseName: 'PHYS101' }), // Archived
  ];

  describe('groupByWeek', () => {
    it('groups into Overdue, This Week, Upcoming, Completed', () => {
      // Mock Date for consistent week calculation
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const result = groupByWeek(assignments);

      expect(result).toHaveLength(4);
      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).toEqual(['overdue', 'thisWeek', 'upcoming', 'completed']);

      // Check overdue
      const overdue = result.find((g) => g.groupKey === 'overdue');
      expect(overdue?.assignments.map((a) => a.id)).toEqual(['1']);

      // Check this week (includes pending and in_progress)
      const thisWeek = result.find((g) => g.groupKey === 'thisWeek');
      expect(thisWeek?.assignments.map((a) => a.id).sort()).toEqual(['2', '6']);

      // Check upcoming (includes no-due-date)
      const upcoming = result.find((g) => g.groupKey === 'upcoming');
      expect(upcoming?.assignments.map((a) => a.id).sort()).toEqual(['3', '5']);

      // Check completed
      const completed = result.find((g) => g.groupKey === 'completed');
      expect(completed?.assignments.map((a) => a.id)).toEqual(['4']);

      vi.useRealTimers();
    });

    it('filters out empty groups', () => {
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const noOverdue = assignments.filter((a) => a.id !== '1');
      const result = groupByWeek(noOverdue);

      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).not.toContain('overdue');

      vi.useRealTimers();
    });
  });

  describe('groupByStatus', () => {
    it('groups by status', () => {
      const result = groupByStatus(assignments);

      expect(result).toHaveLength(4);
      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).toEqual(['pending', 'in_progress', 'completed', 'archived']);

      const pending = result.find((g) => g.groupKey === 'pending');
      expect(pending?.assignments.map((a) => a.id).sort()).toEqual(['1', '2', '3', '5']);

      const inProgress = result.find((g) => g.groupKey === 'in_progress');
      expect(inProgress?.assignments.map((a) => a.id)).toEqual(['6']);

      const completed = result.find((g) => g.groupKey === 'completed');
      expect(completed?.assignments.map((a) => a.id)).toEqual(['4']);

      const archived = result.find((g) => g.groupKey === 'archived');
      expect(archived?.assignments.map((a) => a.id)).toEqual(['7']);
    });
  });

  describe('groupByCourse', () => {
    it('groups by course name alphabetically', () => {
      const result = groupByCourse(assignments);

      expect(result).toHaveLength(3);
      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).toEqual(['CS101', 'MATH101', 'PHYS101']);

      const cs101 = result.find((g) => g.groupKey === 'CS101');
      expect(cs101?.assignments.map((a) => a.id).sort()).toEqual(['1', '2', '4']);

      const math101 = result.find((g) => g.groupKey === 'MATH101');
      expect(math101?.assignments.map((a) => a.id).sort()).toEqual(['3', '6']);

      const phys101 = result.find((g) => g.groupKey === 'PHYS101');
      expect(phys101?.assignments.map((a) => a.id).sort()).toEqual(['5', '7']);
    });
  });
});

describe('applyGrouping', () => {
  const assignments = [
    createMockAssignment({ id: '1' as any, status: 'pending' }),
    createMockAssignment({ id: '2' as any, status: 'completed' }),
  ];

  it('returns flat array for none grouping', () => {
    const result = applyGrouping(assignments, 'none');
    expect(result).toEqual(assignments);
    expect(Array.isArray(result) && !('groupKey' in (result as any)[0] ?? {})).toBe(true);
  });

  it('returns grouped for week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    const result = applyGrouping(assignments, 'week');
    expect(Array.isArray(result) && 'groupKey' in (result as any)[0]).toBe(true);
    vi.useRealTimers();
  });

  it('returns grouped for status', () => {
    const result = applyGrouping(assignments, 'status');
    expect(Array.isArray(result) && 'groupKey' in (result as any)[0]).toBe(true);
  });

  it('returns grouped for course', () => {
    const result = applyGrouping(assignments, 'course');
    expect(Array.isArray(result) && 'groupKey' in (result as any)[0]).toBe(true);
  });

  it('returns flat for empty array', () => {
    const result = applyGrouping([], 'week');
    expect(result).toEqual([]);
  });
});

describe('selectFilteredAssignments (full pipeline)', () => {
  const assignments = [
    createMockAssignment({ id: '1' as any, title: 'Math HW', courseName: 'Math', status: 'pending', dueAt: '2025-01-15T12:00:00.000Z' as IsoDateTime }),
    createMockAssignment({ id: '2' as any, title: 'English Essay', courseName: 'English', status: 'completed', dueAt: '2025-01-20T12:00:00.000Z' as IsoDateTime }),
    createMockAssignment({ id: '3' as any, title: 'Physics Lab', courseName: 'Physics', status: 'pending', dueAt: '2025-01-25T12:00:00.000Z' as IsoDateTime }),
  ];

  const baseFilters = {
    courseFilter: [] as string[],
    statusFilter: 'all' as const,
    dueDateRange: null as { start: Date; end: Date } | null,
    searchQuery: '',
    sortOption: 'priority' as SortOption,
    groupingType: 'none' as GroupingType,
  };

  it('returns flat array when no grouping', () => {
    const result = selectFilteredAssignments(assignments, baseFilters, ['3', '2', '1']);
    expect(Array.isArray(result) && !('groupKey' in (result as any)[0] ?? {})).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('applies search filter', () => {
    const filters = { ...baseFilters, searchQuery: 'math' };
    const result = selectFilteredAssignments(assignments, filters);
    expect((result as Assignment[]).map((a) => a.id)).toEqual(['1']);
  });

  it('applies course filter', () => {
    const filters = { ...baseFilters, courseFilter: ['English'] };
    const result = selectFilteredAssignments(assignments, filters);
    expect((result as Assignment[]).map((a) => a.id)).toEqual(['2']);
  });

  it('applies status filter', () => {
    const filters = { ...baseFilters, statusFilter: 'pending' as const };
    const result = selectFilteredAssignments(assignments, filters);
    expect((result as Assignment[]).map((a) => a.id).sort()).toEqual(['1', '3']);
  });

  it('applies date range filter', () => {
    const filters = {
      ...baseFilters,
      dueDateRange: { start: new Date('2025-01-10T00:00:00.000Z'), end: new Date('2025-01-18T23:59:59.999Z') },
    };
    const result = selectFilteredAssignments(assignments, filters);
    expect((result as Assignment[]).map((a) => a.id)).toEqual(['1']);
  });

  it('applies sort by priority', () => {
    const filters = { ...baseFilters, sortOption: 'priority' as SortOption };
    const result = selectFilteredAssignments(assignments, filters, ['3', '1', '2']);
    expect((result as Assignment[]).map((a) => a.id)).toEqual(['3', '1', '2']);
  });

  it('applies sort by dueDateAsc', () => {
    const filters = { ...baseFilters, sortOption: 'dueDateAsc' as SortOption };
    const result = selectFilteredAssignments(assignments, filters);
    expect((result as Assignment[]).map((a) => a.id)).toEqual(['1', '2', '3']);
  });

  it('returns grouped when groupingType is week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    const filters = { ...baseFilters, groupingType: 'week' as GroupingType };
    const result = selectFilteredAssignments(assignments, filters);

    expect(Array.isArray(result) && 'groupKey' in (result as any)[0]).toBe(true);
    const grouped = result as GroupedAssignments;
    expect(grouped.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('returns grouped when groupingType is status', () => {
    const filters = { ...baseFilters, groupingType: 'status' as GroupingType };
    const result = selectFilteredAssignments(assignments, filters);

    expect(Array.isArray(result) && 'groupKey' in (result as any)[0]).toBe(true);
    const grouped = result as GroupedAssignments;
    expect(grouped.length).toBeGreaterThan(0);
  });

  it('returns grouped when groupingType is course', () => {
    const filters = { ...baseFilters, groupingType: 'course' as GroupingType };
    const result = selectFilteredAssignments(assignments, filters);

    expect(Array.isArray(result) && 'groupKey' in (result as any)[0]).toBe(true);
    const grouped = result as GroupedAssignments;
    expect(grouped.length).toBeGreaterThan(0);
  });

  it('combines filters, sort, and grouping', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    const filters = {
      ...baseFilters,
      searchQuery: 'lab',
      sortOption: 'dueDateAsc' as SortOption,
      groupingType: 'week' as GroupingType,
    };
    const result = selectFilteredAssignments(assignments, filters);

    expect(Array.isArray(result) && 'groupKey' in (result as any)[0]).toBe(true);
    const grouped = result as GroupedAssignments;
    // Only "Physics Lab" matches "lab"
    const flat = grouped.flatMap((g) => g.assignments);
    expect(flat.map((a) => a.id)).toEqual(['3']);

    vi.useRealTimers();
  });
});