/**
 * Grouping Tests — Pure Grouping Functions
 *
 * Unit tests for the assignment grouping functions in grouping.ts.
 */

// @vitest-environment jsdom

import type { Assignment, IsoDateTime, SortOption } from '@backend/shared/types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  groupByWeek,
  groupByStatus,
  groupByCourse,
  applyGrouping,
  type GroupedAssignments,
} from '../grouping';

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

describe('Grouping Functions', () => {
  // Use a fixed date for consistent week calculations
  // Wednesday, January 15, 2025 12:00:00 UTC
  const now = new Date('2025-01-15T12:00:00.000Z');

  // Mock Intl.DateTimeFormat to return UTC timezone for consistent testing
  const originalDateTimeFormat = Intl.DateTimeFormat;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    // Mock timezone to UTC for deterministic week boundary calculations
    Intl.DateTimeFormat = vi.fn().mockImplementation((...args) => {
      const instance = new originalDateTimeFormat(...args);
      const originalResolvedOptions = instance.resolvedOptions;
      instance.resolvedOptions = () => ({
        ...originalResolvedOptions.call(instance),
        timeZone: 'UTC',
      });
      return instance;
    }) as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    Intl.DateTimeFormat = originalDateTimeFormat;
  });

  const assignments = [
    createMockAssignment({ 
      id: '1' as any, 
      status: 'pending', 
      dueAt: new Date('2025-01-10T12:00:00.000Z').toISOString() as IsoDateTime, 
      courseName: 'CS101' 
    }), // Overdue (before Monday Jan 13)
    createMockAssignment({ 
      id: '2' as any, 
      status: 'pending', 
      dueAt: new Date('2025-01-14T12:00:00.000Z').toISOString() as IsoDateTime, 
      courseName: 'CS101' 
    }), // This week (Tuesday Jan 14)
    createMockAssignment({ 
      id: '3' as any, 
      status: 'pending', 
      dueAt: new Date('2025-01-25T12:00:00.000Z').toISOString() as IsoDateTime, 
      courseName: 'MATH101' 
    }), // Upcoming (after Sunday Jan 19)
    createMockAssignment({ 
      id: '4' as any, 
      status: 'completed', 
      dueAt: new Date('2025-01-10T12:00:00.000Z').toISOString() as IsoDateTime, 
      courseName: 'CS101' 
    }), // Completed
    createMockAssignment({ 
      id: '5' as any, 
      status: 'pending', 
      dueAt: null, 
      courseName: 'PHYS101' 
    }), // No due date
    createMockAssignment({ 
      id: '6' as any, 
      status: 'in_progress', 
      dueAt: new Date('2025-01-14T12:00:00.000Z').toISOString() as IsoDateTime, 
      courseName: 'MATH101' 
    }), // In progress this week
    createMockAssignment({ 
      id: '7' as any, 
      status: 'archived', 
      dueAt: new Date('2025-01-10T12:00:00.000Z').toISOString() as IsoDateTime, 
      courseName: 'PHYS101' 
    }), // Archived
  ];

  describe('groupByWeek', () => {
    it('groups into This Week, Overdue, Upcoming, No Due Date, Completed in correct order', () => {
      const result = groupByWeek(assignments);

      // Should have 5 groups (all non-empty)
      expect(result).toHaveLength(5);
      
      // Check group order matches requirement: This Week → Overdue → Upcoming → No Due Date → Completed
      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).toEqual(['this-week', 'overdue', 'upcoming', 'no-due-date', 'completed']);

      // Check This Week group (includes pending and in_progress due this week)
      const thisWeek = result.find((g) => g.groupKey === 'this-week');
      expect(thisWeek?.groupLabel).toBe('This Week');
      expect(thisWeek?.assignments.map((a) => a.id).sort()).toEqual(['2', '6']);
      expect(thisWeek?.count).toBe(2);

      // Check Overdue group
      const overdue = result.find((g) => g.groupKey === 'overdue');
      expect(overdue?.groupLabel).toBe('Overdue');
      expect(overdue?.assignments.map((a) => a.id)).toEqual(['1']);
      expect(overdue?.count).toBe(1);

      // Check Upcoming group
      const upcoming = result.find((g) => g.groupKey === 'upcoming');
      expect(upcoming?.groupLabel).toBe('Upcoming');
      expect(upcoming?.assignments.map((a) => a.id).sort()).toEqual(['3']);
      expect(upcoming?.count).toBe(1);

      // Check No Due Date group
      const noDueDate = result.find((g) => g.groupKey === 'no-due-date');
      expect(noDueDate?.groupLabel).toBe('No Due Date');
      expect(noDueDate?.assignments.map((a) => a.id)).toEqual(['5']);
      expect(noDueDate?.count).toBe(1);

      // Check Completed group
      const completed = result.find((g) => g.groupKey === 'completed');
      expect(completed?.groupLabel).toBe('Completed');
      expect(completed?.assignments.map((a) => a.id)).toEqual(['4']);
      expect(completed?.count).toBe(1);
    });

    it('excludes archived assignments from week grouping', () => {
      const result = groupByWeek(assignments);
      
      // Archived assignment (id: '7') should not appear in any group
      const allGroupedIds = result.flatMap((g) => g.assignments.map((a) => a.id));
      expect(allGroupedIds).not.toContain('7');
    });

    it('filters out empty groups', () => {
      // Remove overdue assignment
      const noOverdue = assignments.filter((a) => a.id !== '1');
      const result = groupByWeek(noOverdue);

      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).not.toContain('overdue');
      expect(result).toHaveLength(4);
    });

    it('handles empty assignments array', () => {
      const result = groupByWeek([]);
      expect(result).toEqual([]);
    });

    it('applies sort within groups when sortOption and priorityOrder provided', () => {
      const priorityOrder = ['6', '2', '3', '1', '5', '4']; // 6 first, then 2
      const result = groupByWeek(assignments, 'priority', priorityOrder);

      const thisWeek = result.find((g) => g.groupKey === 'this-week');
      // Within this-week group, 6 should come before 2 due to priority order
      expect(thisWeek?.assignments.map((a) => a.id)).toEqual(['6', '2']);
    });

    it('uses dueDateAsc sort within groups when specified', () => {
      const result = groupByWeek(assignments, 'dueDateAsc');

      const thisWeek = result.find((g) => g.groupKey === 'this-week');
      // Both 2 and 6 have same due date (Jan 14), order preserved
      expect(thisWeek?.assignments.map((a) => a.id)).toEqual(['2', '6']);
    });

    it('uses dueDateDesc sort within groups when specified', () => {
      const result = groupByWeek(assignments, 'dueDateDesc');

      const thisWeek = result.find((g) => g.groupKey === 'this-week');
      // Both 2 and 6 have same due date
      expect(thisWeek?.assignments.map((a) => a.id)).toEqual(['2', '6']);
    });

    it('uses course sort within groups when specified', () => {
      const result = groupByWeek(assignments, 'course');

      const thisWeek = result.find((g) => g.groupKey === 'this-week');
      // CS101 (assignment 2) comes before MATH101 (assignment 6)
      expect(thisWeek?.assignments.map((a) => a.id)).toEqual(['2', '6']);
    });
  });

  describe('groupByStatus', () => {
    it('groups by status: Pending, In Progress, Completed, Archived', () => {
      const result = groupByStatus(assignments);

      expect(result).toHaveLength(4);
      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).toEqual(['pending', 'in_progress', 'completed', 'archived']);

      // Check Pending group
      const pending = result.find((g) => g.groupKey === 'pending');
      expect(pending?.groupLabel).toBe('Pending');
      expect(pending?.assignments.map((a) => a.id).sort()).toEqual(['1', '2', '3', '5']);
      expect(pending?.count).toBe(4);

      // Check In Progress group
      const inProgress = result.find((g) => g.groupKey === 'in_progress');
      expect(inProgress?.groupLabel).toBe('In Progress');
      expect(inProgress?.assignments.map((a) => a.id)).toEqual(['6']);
      expect(inProgress?.count).toBe(1);

      // Check Completed group
      const completed = result.find((g) => g.groupKey === 'completed');
      expect(completed?.groupLabel).toBe('Completed');
      expect(completed?.assignments.map((a) => a.id)).toEqual(['4']);
      expect(completed?.count).toBe(1);

      // Check Archived group
      const archived = result.find((g) => g.groupKey === 'archived');
      expect(archived?.groupLabel).toBe('Archived');
      expect(archived?.assignments.map((a) => a.id)).toEqual(['7']);
      expect(archived?.count).toBe(1);
    });

    it('filters out empty status groups', () => {
      const noCompleted = assignments.filter((a) => a.id !== '4');
      const result = groupByStatus(noCompleted);

      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).not.toContain('completed');
      expect(result).toHaveLength(3);
    });

    it('handles empty assignments array', () => {
      const result = groupByStatus([]);
      expect(result).toEqual([]);
    });

    it('applies sort within status groups', () => {
      const priorityOrder = ['3', '1', '2', '5', '6', '4', '7'];
      const result = groupByStatus(assignments, 'priority', priorityOrder);

      const pending = result.find((g) => g.groupKey === 'pending');
      // Within pending, order should follow priority: 3, 1, 2, 5
      expect(pending?.assignments.map((a) => a.id)).toEqual(['3', '1', '2', '5']);
    });
  });

  describe('groupByCourse', () => {
    it('groups by course name alphabetically', () => {
      const result = groupByCourse(assignments);

      expect(result).toHaveLength(3);
      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).toEqual(['CS101', 'MATH101', 'PHYS101']);

      // Check CS101 group
      const cs101 = result.find((g) => g.groupKey === 'CS101');
      expect(cs101?.groupLabel).toBe('CS101');
      expect(cs101?.assignments.map((a) => a.id).sort()).toEqual(['1', '2', '4']);
      expect(cs101?.count).toBe(3);

      // Check MATH101 group
      const math101 = result.find((g) => g.groupKey === 'MATH101');
      expect(math101?.groupLabel).toBe('MATH101');
      expect(math101?.assignments.map((a) => a.id).sort()).toEqual(['3', '6']);
      expect(math101?.count).toBe(2);

      // Check PHYS101 group
      const phys101 = result.find((g) => g.groupKey === 'PHYS101');
      expect(phys101?.groupLabel).toBe('PHYS101');
      expect(phys101?.assignments.map((a) => a.id).sort()).toEqual(['5', '7']);
      expect(phys101?.count).toBe(2);
    });

    it('filters out empty course groups', () => {
      const noCS101 = assignments.filter((a) => a.courseName !== 'CS101');
      const result = groupByCourse(noCS101);

      const groupKeys = result.map((g) => g.groupKey);
      expect(groupKeys).not.toContain('CS101');
      expect(result).toHaveLength(2);
    });

    it('handles empty assignments array', () => {
      const result = groupByCourse([]);
      expect(result).toEqual([]);
    });

    it('applies sort within course groups', () => {
      const priorityOrder = ['4', '2', '1', '6', '3', '7', '5'];
      const result = groupByCourse(assignments, 'priority', priorityOrder);

      const cs101 = result.find((g) => g.groupKey === 'CS101');
      // Within CS101, order should follow priority: 4, 2, 1
      expect(cs101?.assignments.map((a) => a.id)).toEqual(['4', '2', '1']);
    });
  });

  describe('applyGrouping', () => {
    const testAssignments = [
      createMockAssignment({ id: '1' as any, status: 'pending' }),
      createMockAssignment({ id: '2' as any, status: 'completed' }),
    ];

    it('returns flat array for none grouping', () => {
      const result = applyGrouping(testAssignments, 'none');
      expect(result).toEqual(testAssignments);
      // Verify it's a flat array, not grouped
      expect(Array.isArray(result) && result.length > 0 && !('groupKey' in (result as any)[0])).toBe(true);
    });

    it('returns grouped array for week grouping', () => {
      const result = applyGrouping(testAssignments, 'week');
      expect(Array.isArray(result) && result.length > 0 && 'groupKey' in (result as any)[0]).toBe(true);
    });

    it('returns grouped array for status grouping', () => {
      const result = applyGrouping(testAssignments, 'status');
      expect(Array.isArray(result) && result.length > 0 && 'groupKey' in (result as any)[0]).toBe(true);
    });

    it('returns grouped array for course grouping', () => {
      const result = applyGrouping(testAssignments, 'course');
      expect(Array.isArray(result) && result.length > 0 && 'groupKey' in (result as any)[0]).toBe(true);
    });

    it('returns flat array for empty assignments', () => {
      const result = applyGrouping([], 'week');
      expect(result).toEqual([]);
    });

    it('passes sortOption and priorityOrder to grouping functions', () => {
      const priorityOrder = ['2', '1'];
      const result = applyGrouping(testAssignments, 'status', 'priority', priorityOrder);
      
      const grouped = result as GroupedAssignments[];
      const pending = grouped.find((g) => g.groupKey === 'pending');
      expect(pending?.assignments.map((a) => a.id)).toEqual(['1']);
    });
  });
});

describe('Grouping with different timezones', () => {
  // Test that timezone handling works correctly
  it('uses local timezone for week boundaries', () => {
    // This test verifies the timezone functions are called
    // We can't easily test different timezones without complex mocking,
    // but we can verify the functions don't throw
    const assignments = [
      createMockAssignment({ 
        id: '1' as any, 
        status: 'pending', 
        dueAt: new Date('2025-01-14T12:00:00.000Z').toISOString() as IsoDateTime, 
        courseName: 'CS101' 
      }),
    ];

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    const result = groupByWeek(assignments);
    expect(result.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});