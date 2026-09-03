/**
 * Assignment Selectors — Pure Filter/Sort/Group Functions
 *
 * Pure, testable functions for deriving filtered, sorted, and grouped
 * assignment lists from raw assignments + FilterState.
 *
 * @module @frontend/store/selectors
 */

import type { Assignment, FilterState, SortOption, GroupingType, IsoDateTime } from '@backend/shared/types';
import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

/**
 * Type for grouped assignments returned by grouping functions.
 */
export type GroupedAssignments = {
  groupKey: string;
  groupLabel: string;
  assignments: Assignment[];
}[];

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
      assignment.description.toLowerCase().includes(lowerQuery)
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
  statusFilter: FilterState['statusFilter']
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
  dueDateRange: FilterState['dueDateRange']
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
export function applyFilters(
  assignments: Assignment[],
  filters: FilterState
): Assignment[] {
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
  priorityOrder: string[]
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
  priorityOrder: string[] = []
): Assignment[] {
  if (assignments.length <= 1) return [...assignments];

  const sorted = [...assignments];

  switch (sortOption) {
    case 'priority':
      return sorted.sort(createPrioritySortComparator(priorityOrder));
    case 'dueDateAsc':
      return sorted.sort(sortByDueDateAsc);
    case 'dueDateDesc':
      return sorted.sort(sortByDueDateDesc);
    case 'course':
      return sorted.sort(sortByCourse);
    case 'createdDesc':
      return sorted.sort(sortByCreatedDesc);
    default:
      return sorted;
  }
}

/**
 * Grouping: 'week' — groups by "This Week", "Overdue", "Upcoming", "Completed".
 * Week boundary: Monday 00:00 to Sunday 23:59 in local timezone.
 */
export function groupByWeek(assignments: Assignment[]): GroupedAssignments {
  const now = new Date();
  const startOfThisWeek = startOfDay(now);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay() + 1); // Monday
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 6); // Sunday
  endOfThisWeek.setHours(23, 59, 59, 999);

  const groups: GroupedAssignments = [
    { groupKey: 'overdue', groupLabel: 'Overdue', assignments: [] },
    { groupKey: 'thisWeek', groupLabel: 'This Week', assignments: [] },
    { groupKey: 'upcoming', groupLabel: 'Upcoming', assignments: [] },
    { groupKey: 'completed', groupLabel: 'Completed', assignments: [] },
  ];

  for (const assignment of assignments) {
    if (assignment.status === 'completed') {
      groups[3].assignments.push(assignment);
      continue;
    }

    // Archived assignments are excluded from week grouping
    if (assignment.status === 'archived') {
      continue;
    }

    if (!assignment.dueAt) {
      groups[2].assignments.push(assignment); // No due date → Upcoming
      continue;
    }

    const dueDate = parseISO(assignment.dueAt);

    if (dueDate < startOfThisWeek) {
      groups[0].assignments.push(assignment); // Overdue
    } else if (isWithinInterval(dueDate, { start: startOfThisWeek, end: endOfThisWeek })) {
      groups[1].assignments.push(assignment); // This Week
    } else {
      groups[2].assignments.push(assignment); // Upcoming
    }
  }

  // Filter out empty groups
  return groups.filter((g) => g.assignments.length > 0);
}

/**
 * Grouping: 'status' — groups by "Pending", "In Progress", "Completed", "Archived".
 */
export function groupByStatus(assignments: Assignment[]): GroupedAssignments {
  const statusGroups: Record<Assignment['status'], Assignment[]> = {
    pending: [],
    in_progress: [],
    completed: [],
    archived: [],
  };

  for (const assignment of assignments) {
    statusGroups[assignment.status].push(assignment);
  }

  return [
    { groupKey: 'pending', groupLabel: 'Pending', assignments: statusGroups.pending },
    { groupKey: 'in_progress', groupLabel: 'In Progress', assignments: statusGroups.in_progress },
    { groupKey: 'completed', groupLabel: 'Completed', assignments: statusGroups.completed },
    { groupKey: 'archived', groupLabel: 'Archived', assignments: statusGroups.archived },
  ].filter((g) => g.assignments.length > 0);
}

/**
 * Grouping: 'course' — groups by course name.
 */
export function groupByCourse(assignments: Assignment[]): GroupedAssignments {
  const courseMap = new Map<string, Assignment[]>();

  for (const assignment of assignments) {
    const courseName = assignment.courseName;
    if (!courseMap.has(courseName)) {
      courseMap.set(courseName, []);
    }
    courseMap.get(courseName)!.push(assignment);
  }

  // Sort courses alphabetically
  return Array.from(courseMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([courseName, assignments]) => ({
      groupKey: courseName,
      groupLabel: courseName,
      assignments,
    }));
}

/**
 * Applies grouping based on groupingType.
 * Returns flat array if groupingType is 'none', otherwise GroupedAssignments.
 */
export function applyGrouping(
  assignments: Assignment[],
  groupingType: GroupingType
): Assignment[] | GroupedAssignments {
  if (groupingType === 'none' || assignments.length === 0) {
    return assignments;
  }

  switch (groupingType) {
    case 'week':
      return groupByWeek(assignments);
    case 'status':
      return groupByStatus(assignments);
    case 'course':
      return groupByCourse(assignments);
    default:
      return assignments;
  }
}

/**
 * Full pipeline: filter → sort → group.
 * Returns flat Assignment[] if groupingType === 'none', otherwise GroupedAssignments.
 * Memoized: returns cached result when inputs are referentially equal.
 */
let selectFilteredAssignmentsCache: {
  assignments: Assignment[];
  filters: FilterState;
  priorityOrder: string[];
  result: Assignment[] | GroupedAssignments;
} | null = null;

export function selectFilteredAssignments(
  assignments: Assignment[],
  filters: FilterState,
  priorityOrder: string[] = []
): Assignment[] | GroupedAssignments {
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
  const grouped = applyGrouping(sorted, filters.groupingType);

  // Update cache
  selectFilteredAssignmentsCache = {
    assignments,
    filters,
    priorityOrder,
    result: grouped,
  };

  return grouped;
}