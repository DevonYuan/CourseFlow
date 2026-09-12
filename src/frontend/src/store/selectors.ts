/**
 * Assignment Selectors — Pure Filter/Sort/Group Functions
 *
 * Pure, testable functions for deriving filtered, sorted, and grouped
 * assignment lists from raw assignments + FilterState.
 *
 * @module @frontend/store/selectors
 */

import type { Assignment, SortOption } from '@backend/shared/types';
import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

import type { FilterState } from './assignmentsStore';
import { type GroupedAssignments, applyGrouping } from './grouping';

/**
 * Type for grouped assignments returned by grouping functions.
 * Re-exported from grouping.ts for backward compatibility.
 */
export type { GroupedAssignments } from './grouping';

/**
 * Grouping functions re-exported from grouping.ts for backward compatibility.
 */
export { groupByWeek, groupByStatus, groupByCourse, applyGrouping } from './grouping';

/**
 * Filter: Search — case-insensitive substring match on title, course_name, description.
 */
export function filterBySearch(assignments: Assignment[], query: string): Assignment[] {
  if (!query.trim()) return assignments;

  const lowerQuery = query.toLowerCase().trim();
  return assignments.filter(
    (assignment) =>
      assignment.title.toLowerCase().includes(lowerQuery) ||
      assignment.courseName.toLowerCase().includes(lowerQuery) ||
      assignment.description.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Filter: Course — include only if courseName in courseFilter (empty = all).
 */
export function filterByCourse(assignments: Assignment[], courseFilter: string[]): Assignment[] {
  if (courseFilter.length === 0) return assignments;
  return assignments.filter((assignment) => courseFilter.includes(assignment.courseName));
}

/**
 * Filter: Status — 'pending' excludes completed, 'completed' only completed, 'all' = no filter.
 */
export function filterByStatus(
  assignments: Assignment[],
  statusFilter: FilterState['statusFilter'],
): Assignment[] {
  if (statusFilter === 'all') return assignments;
  if (statusFilter === 'pending') {
    return assignments.filter((a) => a.status !== 'completed');
  }
  if (statusFilter === 'completed') {
    return assignments.filter((a) => a.status === 'completed');
  }
  return assignments;
}

/**
 * Filter: Date Range — due_at within [start, end] (inclusive), null bounds ignored.
 */
export function filterByDateRange(
  assignments: Assignment[],
  dueDateRange: FilterState['dueDateRange'],
): Assignment[] {
  if (!dueDateRange) return assignments;

  const { start, end } = dueDateRange;
  const intervalStart = startOfDay(start);
  const intervalEnd = endOfDay(end);

  return assignments.filter((assignment) => {
    if (!assignment.dueAt) return false;
    const dueDate = parseISO(assignment.dueAt);
    return isWithinInterval(dueDate, { start: intervalStart, end: intervalEnd });
  });
}

/**
 * Combined filter pipeline — applies all filters in order:
 * search → course → status → dateRange
 */
export function applyFilters(assignments: Assignment[], filters: FilterState): Assignment[] {
  let result = assignments;
  result = filterBySearch(result, filters.searchQuery);
  result = filterByCourse(result, filters.courseFilter);
  result = filterByStatus(result, filters.statusFilter);
  result = filterByDateRange(result, filters.dueDateRange);
  return result;
}

/**
 * Sort comparator for 'priority' — by priorityOrder position, then due_at for ties.
 * Assignments not in priorityOrder sort to end (Infinity).
 */
export function createPrioritySortComparator(
  priorityOrder: string[],
): (a: Assignment, b: Assignment) => number {
  const orderMap = new Map(priorityOrder.map((id, index) => [id, index]));

  return (a: Assignment, b: Assignment) => {
    const aIndex = orderMap.get(a.id) ?? Infinity;
    const bIndex = orderMap.get(b.id) ?? Infinity;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    // Tie-breaker: due_at ascending (nulls last)
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  };
}

/**
 * Sort comparator for 'dueDateAsc' — due_at ASC (nulls last).
 */
export function sortByDueDateAsc(a: Assignment, b: Assignment): number {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

/**
 * Sort comparator for 'dueDateDesc' — due_at DESC (nulls first).
 */
export function sortByDueDateDesc(a: Assignment, b: Assignment): number {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return -1;
  if (!b.dueAt) return 1;
  return new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime();
}

/**
 * Sort comparator for 'course' — course_name ASC, then due_at ASC.
 */
export function sortByCourse(a: Assignment, b: Assignment): number {
  const courseCompare = a.courseName.localeCompare(b.courseName);
  if (courseCompare !== 0) return courseCompare;

  // Tie-breaker: due_at ascending (nulls last)
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

/**
 * Sort comparator for 'createdDesc' — created_at DESC.
 */
export function sortByCreatedDesc(a: Assignment, b: Assignment): number {
  if (!a.createdAt && !b.createdAt) return 0;
  if (!a.createdAt) return 1;
  if (!b.createdAt) return -1;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Applies sort to assignments based on sortOption.
 * For 'priority' sort, requires priorityOrder array.
 */
export function applySort(
  assignments: Assignment[],
  sortOption: SortOption,
  priorityOrder: string[] = [],
): Assignment[] {
  if (assignments.length <= 1) return [...assignments];

  const sorted = [...assignments];

  switch (sortOption) {
    case 'priority': {
      return sorted.sort(createPrioritySortComparator(priorityOrder));
    }
    case 'dueDateAsc': {
      return sorted.sort(sortByDueDateAsc);
    }
    case 'dueDateDesc': {
      return sorted.sort(sortByDueDateDesc);
    }
    case 'course': {
      return sorted.sort(sortByCourse);
    }
    case 'createdDesc': {
      return sorted.sort(sortByCreatedDesc);
    }
    default: {
      return sorted;
    }
  }
}

/**
 * Full pipeline: filter → sort → group.
 * Returns flat Assignment[] if groupingType === 'none', otherwise GroupedAssignments[].
 * Memoized: returns cached result when inputs are referentially equal.
 */
let selectFilteredAssignmentsCache: {
  assignments: Assignment[];
  filters: FilterState;
  priorityOrder: string[];
  result: Assignment[] | GroupedAssignments[];
} | null = null;

export function selectFilteredAssignments(
  assignments: Assignment[],
  filters: FilterState,
  priorityOrder: string[] = [],
): Assignment[] | GroupedAssignments[] {
  // Check cache - compare by reference for arrays/objects
  if (
    selectFilteredAssignmentsCache &&
    selectFilteredAssignmentsCache.assignments === assignments &&
    selectFilteredAssignmentsCache.filters === filters &&
    selectFilteredAssignmentsCache.priorityOrder === priorityOrder
  ) {
    return selectFilteredAssignmentsCache.result;
  }

  const filtered = applyFilters(assignments, filters);
  const sorted = applySort(filtered, filters.sortOption, priorityOrder);
  const grouped = applyGrouping(sorted, filters.groupingType, filters.sortOption, priorityOrder);

  // Update cache
  selectFilteredAssignmentsCache = {
    assignments,
    filters,
    priorityOrder,
    result: grouped,
  };

  return grouped;
}
