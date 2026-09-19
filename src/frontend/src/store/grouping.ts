/**
 * Grouping Functions — Pure Filter/Sort/Group Logic
 *
 * Pure, testable functions for grouping assignments by various criteria.
 * All timezone boundaries use the user's local timezone.
 *
 * @module @frontend/store/grouping
 */

import type { Assignment, GroupingType, SortOption } from '@backend/shared/types';
import { parseISO } from 'date-fns';

/**
 * Type for grouped assignments returned by grouping functions.
 */
export interface GroupedAssignments {
  groupKey: string;
  groupLabel: string;
  assignments: Assignment[];
  count: number;
}

/**
 * Gets the start of the current week (Monday 00:00) in local timezone as a UTC timestamp.
 * Uses native Date methods which operate in the browser's local timezone.
 */
function getStartOfWeekTimestamp(): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  // Adjust to Monday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = startOfWeek.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Days to subtract to get to Monday
  startOfWeek.setDate(startOfWeek.getDate() + diff);
  return startOfWeek.getTime(); // UTC timestamp of local Monday 00:00
}

/**
 * Gets the end of the current week (Sunday 23:59:59.999) in local timezone as a UTC timestamp.
 */
function getEndOfWeekTimestamp(): number {
  const startOfWeek = new Date(getStartOfWeekTimestamp());
  const endOfWeekDate = new Date(startOfWeek);
  endOfWeekDate.setDate(endOfWeekDate.getDate() + 6); // Sunday
  endOfWeekDate.setHours(23, 59, 59, 999);
  return endOfWeekDate.getTime(); // UTC timestamp of local Sunday 23:59:59.999
}

/**
 * Gets the current time as a UTC timestamp.
 */
function getNowTimestamp(): number {
  return Date.now();
}

/**
 * Checks if a date is within the current week (Mon 00:00 - Sun 23:59) in local TZ.
 * Compares UTC timestamps directly.
 */
function isInCurrentWeek(date: Date): boolean {
  const start = getStartOfWeekTimestamp();
  const end = getEndOfWeekTimestamp();
  const dateTime = date.getTime();
  return dateTime >= start && dateTime <= end;
}

/**
 * Checks if a date is overdue (before now) in local timezone.
 * Compares UTC timestamps directly.
 */
function isOverdue(date: Date): boolean {
  const now = getNowTimestamp();
  return date.getTime() < now;
}

/**
 * Applies sort within a group based on sortOption.
 * For 'priority' sort, requires priorityOrder array.
 */
function applySortWithinGroup(
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
 * Sort comparator for 'priority' — by priorityOrder position, then due_at for ties.
 * Assignments not in priorityOrder sort to end (Infinity).
 */
function createPrioritySortComparator(
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
function sortByDueDateAsc(a: Assignment, b: Assignment): number {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

/**
 * Sort comparator for 'dueDateDesc' — due_at DESC (nulls first).
 */
function sortByDueDateDesc(a: Assignment, b: Assignment): number {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return -1;
  if (!b.dueAt) return 1;
  return new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime();
}

/**
 * Sort comparator for 'course' — course_name ASC, then due_at ASC.
 */
function sortByCourse(a: Assignment, b: Assignment): number {
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
function sortByCreatedDesc(a: Assignment, b: Assignment): number {
  if (!a.createdAt && !b.createdAt) return 0;
  if (!a.createdAt) return 1;
  if (!b.createdAt) return -1;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Grouping: 'week' — groups by "This Week", "Overdue", "Upcoming", "No Due Date", "Completed".
 * Week boundary: Monday 00:00 to Sunday 23:59 in local timezone.
 * Group order: This Week → Overdue → Upcoming → No Due Date → Completed
 */
export function groupByWeek(
  assignments: Assignment[],
  sortOption: SortOption = 'priority',
  priorityOrder: string[] = [],
): GroupedAssignments[] {
  // Initialize groups in the required order
  const groups: GroupedAssignments[] = [
    { groupKey: 'this-week', groupLabel: 'This Week', assignments: [], count: 0 },
    { groupKey: 'overdue', groupLabel: 'Overdue', assignments: [], count: 0 },
    { groupKey: 'upcoming', groupLabel: 'Upcoming', assignments: [], count: 0 },
    { groupKey: 'no-due-date', groupLabel: 'No Due Date', assignments: [], count: 0 },
    { groupKey: 'completed', groupLabel: 'Completed', assignments: [], count: 0 },
  ];

  for (const assignment of assignments) {
    // Completed assignments always go to Completed group (regardless of due date)
    if (assignment.status === 'completed') {
      groups[4]!.assignments.push(assignment);
      continue;
    }

    // Archived assignments are excluded from week grouping
    if (assignment.status === 'archived') {
      continue;
    }

    // No due date → No Due Date group
    if (!assignment.dueAt) {
      groups[3]!.assignments.push(assignment);
      continue;
    }

    const dueDate = parseISO(assignment.dueAt);

    // Check This Week first (per ticket spec: This Week → Overdue → Upcoming)
    if (isInCurrentWeek(dueDate)) {
      groups[0]!.assignments.push(assignment); // This Week
    } else if (isOverdue(dueDate)) {
      groups[1]!.assignments.push(assignment); // Overdue
    } else {
      groups[2]!.assignments.push(assignment); // Upcoming
    }
  }

  // Apply sort within each group and update count
  return groups
    .map((group): GroupedAssignments => ({
      ...group,
      assignments: applySortWithinGroup(group.assignments, sortOption, priorityOrder),
      count: group.assignments.length,
    }))
    .filter((group): group is GroupedAssignments => group.count > 0);
}

/**
 * Grouping: 'status' — groups by "Pending", "In Progress", "Completed", "Archived".
 * Note: This doesn't follow the week-based order since it's status-based.
 * Group order: Pending → In Progress → Completed → Archived
 */
export function groupByStatus(
  assignments: Assignment[],
  sortOption: SortOption = 'priority',
  priorityOrder: string[] = [],
): GroupedAssignments[] {
  const statusGroups = new Map<Assignment['status'], Assignment[]>([
    ['pending', []],
    ['in_progress', []],
    ['completed', []],
    ['archived', []],
  ]);

  for (const assignment of assignments) {
    const group = statusGroups.get(assignment.status);
    if (group) {
      group.push(assignment);
    }
  }

  return [
    { groupKey: 'pending', groupLabel: 'Pending', assignments: statusGroups.get('pending')! },
    {
      groupKey: 'in_progress',
      groupLabel: 'In Progress',
      assignments: statusGroups.get('in_progress')!,
    },
    { groupKey: 'completed', groupLabel: 'Completed', assignments: statusGroups.get('completed')! },
    { groupKey: 'archived', groupLabel: 'Archived', assignments: statusGroups.get('archived')! },
  ]
    .map((group): GroupedAssignments => ({
      ...group,
      assignments: applySortWithinGroup(group.assignments, sortOption, priorityOrder),
      count: group.assignments.length,
    }))
    .filter((group): group is GroupedAssignments => group.count > 0);
}

/**
 * Grouping: 'course' — groups by course name, sorted alphabetically.
 * Within each course group, assignments respect the current sortOption.
 */
export function groupByCourse(
  assignments: Assignment[],
  sortOption: SortOption = 'priority',
  priorityOrder: string[] = [],
): GroupedAssignments[] {
  const courseMap = new Map<string, Assignment[]>();

  for (const assignment of assignments) {
    const courseName = assignment.courseName;
    if (!courseMap.has(courseName)) {
      courseMap.set(courseName, []);
    }
    courseMap.get(courseName)!.push(assignment);
  }

  // Sort courses alphabetically and apply sort within each group
  return [...courseMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([courseName, assignments]): GroupedAssignments => ({
      groupKey: courseName,
      groupLabel: courseName,
      assignments: applySortWithinGroup(assignments, sortOption, priorityOrder),
      count: assignments.length,
    }))
    .filter((group): group is GroupedAssignments => group.count > 0);
}

/**
 * Grouping: 'calendar' — groups by calendar source, ordered by calendar position.
 * Assignments without sourceId (legacy/manual) go to "Uncategorized" group.
 * Within each calendar group, assignments respect the current sortOption.
 */
export function groupByCalendar(
  assignments: Assignment[],
  sortOption: SortOption = 'priority',
  priorityOrder: string[] = [],
  calendarsMap: Map<string, { name: string; color: string; position: number }> = new Map(),
): GroupedAssignments[] {
  const calendarMap = new Map<string, Assignment[]>();

  for (const assignment of assignments) {
    const sourceId = assignment.sourceId ?? 'uncategorized';
    if (!calendarMap.has(sourceId)) {
      calendarMap.set(sourceId, []);
    }
    calendarMap.get(sourceId)!.push(assignment);
  }

  // Convert to array and sort by calendar position
  const sortedEntries = [...calendarMap.entries()].sort(([aId], [bId]) => {
    const aCal = calendarsMap.get(aId);
    const bCal = calendarsMap.get(bId);
    const aPos = aCal?.position ?? Number.MAX_SAFE_INTEGER;
    const bPos = bCal?.position ?? Number.MAX_SAFE_INTEGER;
    return aPos - bPos;
  });

  return sortedEntries
    .map(([sourceId, assignments]): GroupedAssignments => {
      const cal = calendarsMap.get(sourceId);
      const groupLabel = cal?.name ?? (sourceId === 'uncategorized' ? 'Uncategorized' : 'Unknown Calendar');
      return {
        groupKey: sourceId,
        groupLabel,
        assignments: applySortWithinGroup(assignments, sortOption, priorityOrder),
        count: assignments.length,
      };
    })
    .filter((group): group is GroupedAssignments => group.count > 0);
}

/**
 * Applies grouping based on groupingType.
 * Returns flat array if groupingType is 'none', otherwise GroupedAssignments[].
 */
export function applyGrouping(
  assignments: Assignment[],
  groupingType: GroupingType,
  sortOption: SortOption = 'priority',
  priorityOrder: string[] = [],
  calendarsMap?: Map<string, { name: string; color: string; position: number }>,
): Assignment[] | GroupedAssignments[] {
  if (groupingType === 'none' || assignments.length === 0) {
    return assignments;
  }

  switch (groupingType) {
    case 'week': {
      return groupByWeek(assignments, sortOption, priorityOrder);
    }
    case 'status': {
      return groupByStatus(assignments, sortOption, priorityOrder);
    }
    case 'course': {
      return groupByCourse(assignments, sortOption, priorityOrder);
    }
    case 'calendar': {
      return groupByCalendar(assignments, sortOption, priorityOrder, calendarsMap ?? new Map());
    }
    default: {
      return assignments;
    }
  }
}
