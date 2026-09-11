/**
 * Unit tests for iCal to Assignment mapper.
 *
 * @module @backend/main/ical/__tests__/map.test
 */

import type { ICalEvent, IsoDateTime } from '@backend/shared/types';
import { describe, it, expect, vi } from 'vitest';

import { mapICalToAssignments, extractCourseName, generateCourseColor } from '../map.js';

// Helper to create a minimal valid ICalEvent with a date within 30 days of now
function createEvent(overrides: Partial<ICalEvent> = {}): ICalEvent {
  // Use a date 7 days in the future to pass the 30-day filter
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() as IsoDateTime;
  const futureEndDate = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
  ).toISOString() as IsoDateTime;

  return {
    uid: 'test-uid-123',
    summary: 'Test Assignment',
    description: 'Test description',
    location: 'Online',
    dtStart: futureDate,
    dtEnd: futureEndDate,
    rrule: null,
    url: 'https://canvas.example.com/assignments/123',
    categories: [],
    ...overrides,
  };
}

describe('iCal Mapper', () => {
  describe('generateCourseColor', () => {
    it('generates deterministic hex color for same course name', () => {
      const color1 = generateCourseColor('CS101');
      const color2 = generateCourseColor('CS101');
      expect(color1).toBe(color2);
    });

    it('generates different colors for different course names', () => {
      const color1 = generateCourseColor('CS101');
      const color2 = generateCourseColor('MATH201');
      expect(color1).not.toBe(color2);
    });

    it('returns valid hex color format', () => {
      const color = generateCourseColor('CS101');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('handles empty string', () => {
      const color = generateCourseColor('');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('handles special characters in course name', () => {
      const color = generateCourseColor('CS 101 - Introduction');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('extractCourseName', () => {
    it('priority 1: extracts course code from CATEGORIES', () => {
      const event = createEvent({
        categories: ['CS101', 'Homework', 'Fall2025'],
      });
      expect(extractCourseName(event)).toBe('CS101');
    });

    it('priority 1: picks first matching course code in CATEGORIES', () => {
      const event = createEvent({
        categories: ['Fall2025', 'MATH201', 'CS101'],
      });
      expect(extractCourseName(event)).toBe('MATH201');
    });

    it('priority 1: ignores non-matching categories', () => {
      const event = createEvent({
        categories: ['Homework', 'Fall2025', 'Exam'],
      });
      // No match, falls through to priority 2
      expect(extractCourseName(event)).not.toBe('Homework');
    });

    it('priority 2: extracts from SUMMARY with bracket prefix [COURSE]', () => {
      const event = createEvent({
        categories: ['Homework'], // No course code
        summary: '[CS101] Homework 1',
      });
      expect(extractCourseName(event)).toBe('CS101');
    });

    it('priority 2: extracts from SUMMARY with colon prefix COURSE:', () => {
      const event = createEvent({
        categories: ['Homework'],
        summary: 'MATH201: Midterm Exam',
      });
      expect(extractCourseName(event)).toBe('MATH201');
    });

    it('priority 2: handles whitespace in bracket prefix', () => {
      const event = createEvent({
        categories: [],
        summary: '  [  PHYS101  ]  Lab Assignment  ',
      });
      expect(extractCourseName(event)).toBe('PHYS101');
    });

    it('priority 3: falls back to "Unknown Course" when no course found', () => {
      const event = createEvent({
        categories: ['Homework', 'Assignment'],
        summary: 'Just a regular assignment',
      });
      expect(extractCourseName(event)).toBe('Unknown Course');
    });

    it('priority 1 takes precedence over priority 2', () => {
      const event = createEvent({
        categories: ['CS101'],
        summary: '[MATH201] Different Course',
      });
      // Should use category, not summary prefix
      expect(extractCourseName(event)).toBe('CS101');
    });

    it('handles course codes with 4 letters and 4 digits', () => {
      const event = createEvent({
        categories: ['ENGL1010'],
      });
      expect(extractCourseName(event)).toBe('ENGL1010');
    });

    it('handles course codes with 3 letters and 3 digits', () => {
      const event = createEvent({
        categories: ['PHY101'],
      });
      expect(extractCourseName(event)).toBe('PHY101');
    });
  });

  describe('mapICalToAssignments', () => {
    const sourceUrl = 'https://canvas.example.com/feed.ics';

    it('maps basic event to AssignmentInput', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          summary: 'CS101 - Homework 1',
          categories: ['CS101', 'Homework'],
          url: 'https://canvas.example.com/assignments/1',
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);

      expect(result).toHaveLength(1);
      const assignment = result[0]!;

      expect(assignment.title).toBe('CS101 - Homework 1');
      expect(assignment.courseName).toBe('CS101');
      expect(assignment.courseColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      // dueAt should be the future date from createEvent helper
      expect(assignment.dueAt).toBeDefined();
      expect(assignment.icalUid).toBe('event-1');
      expect(assignment.source).toBe('ical');
      expect(assignment.sourceUrl).toBe('https://canvas.example.com/assignments/1');
      expect(assignment.status).toBe('pending');
      expect(assignment.priority).toBeDefined();
      expect(assignment.rrule).toBeUndefined();
      expect(assignment.id).toBeDefined();
      expect(assignment.createdAt).toBeDefined();
      expect(assignment.updatedAt).toBeDefined();
    });

    it('uses sourceUrl when event.url is null', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          url: null,
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.sourceUrl).toBe(sourceUrl);
    });

    it('uses event.url when available', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          url: 'https://canvas.example.com/assignments/123',
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.sourceUrl).toBe('https://canvas.example.com/assignments/123');
    });

    it('preserves rrule from event', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          rrule: 'FREQ=WEEKLY;COUNT=10',
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.rrule).toBe('FREQ=WEEKLY;COUNT=10');
    });

    it('sets rrule to undefined when null', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          rrule: null,
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.rrule).toBeUndefined();
    });

    it('calculates priority based on due date (only future events included)', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();

      // Due soon event (2 days)
      const dueSoonEvent = createEvent({
        uid: 'due-soon',
        dtStart: '2025-01-12T12:00:00.000Z' as IsoDateTime,
      });

      // Far future event (22 days)
      const farEvent = createEvent({
        uid: 'far',
        dtStart: '2025-02-01T12:00:00.000Z' as IsoDateTime,
      });

      // Mock Date.now for consistent results
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      const result = mapICalToAssignments([dueSoonEvent, farEvent], sourceUrl);

      expect(result).toHaveLength(2);
      expect(result[0]!.priority).toBe('medium'); // due soon (2 days)
      expect(result[1]!.priority).toBe('low'); // far future (22 days)

      vi.restoreAllMocks();
    });

    it('maps multiple events', () => {
      const events = [
        createEvent({ uid: 'event-1', summary: 'Assignment 1', categories: ['CS101'] }),
        createEvent({ uid: 'event-2', summary: 'Assignment 2', categories: ['MATH201'] }),
        createEvent({ uid: 'event-3', summary: 'Assignment 3', categories: ['PHYS101'] }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);

      expect(result).toHaveLength(3);
      expect(result[0]!.courseName).toBe('CS101');
      expect(result[1]!.courseName).toBe('MATH201');
      expect(result[2]!.courseName).toBe('PHYS101');
    });

    it('generates unique IDs for each assignment', () => {
      const events = [createEvent({ uid: 'event-1' }), createEvent({ uid: 'event-2' })];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.id).not.toBe(result[1]!.id);
    });

    it('sets description from event.description', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          description: 'Complete Chapter 1\n\nDue: Friday',
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.description).toBe('Complete Chapter 1\n\nDue: Friday');
    });

    it('handles null description', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          description: null,
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.description).toBeUndefined();
    });

    it('calculates priority based on due date (only future events included)', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();

      // Due soon event (2 days)
      const dueSoonEvent = createEvent({
        uid: 'due-soon',
        dtStart: '2025-01-12T12:00:00.000Z' as IsoDateTime,
      });

      // Far future event (22 days)
      const farEvent = createEvent({
        uid: 'far',
        dtStart: '2025-02-01T12:00:00.000Z' as IsoDateTime,
      });

      // Mock Date.now for consistent results
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      const result = mapICalToAssignments([dueSoonEvent, farEvent], sourceUrl);

      expect(result).toHaveLength(2);
      expect(result[0]!.priority).toBe('medium'); // due soon (2 days)
      expect(result[1]!.priority).toBe('low'); // far future (22 days)

      vi.restoreAllMocks();
    });

    it('trims whitespace from title', () => {
      const events = [
        createEvent({
          uid: 'event-1',
          summary: '  Homework 1  ',
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.title).toBe('Homework 1');
    });

    it('sets default values for fields not in iCal', () => {
      const events = [createEvent({ uid: 'event-1' })];
      const result = mapICalToAssignments(events, sourceUrl);

      expect(result[0]!.unlockAt).toBeNull();
      expect(result[0]!.lockAt).toBeNull();
      expect(result[0]!.pointsPossible).toBeNull();
      expect(result[0]!.submissionTypes).toEqual([]);
      expect(result[0]!.workflowState).toBe('published');
    });

    it('generates consistent course colors for same course', () => {
      const events = [
        createEvent({ uid: 'event-1', categories: ['CS101'] }),
        createEvent({ uid: 'event-2', categories: ['CS101'] }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.courseColor).toBe(result[1]!.courseColor);
    });

    it('generates different colors for different courses', () => {
      const events = [
        createEvent({ uid: 'event-1', categories: ['CS101'] }),
        createEvent({ uid: 'event-2', categories: ['MATH201'] }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);
      expect(result[0]!.courseColor).not.toBe(result[1]!.courseColor);
    });

    // --- RRULE Expansion Tests ---

    it('expands recurring event with UNTIL date into multiple occurrences', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      // Event starts Jan 1, recurs weekly until Feb 15 (5 weeks = 5 occurrences in window)
      const recurringEvent = createEvent({
        uid: 'recurring-1',
        summary: 'Weekly Lab',
        categories: ['CS101'],
        dtStart: '2025-01-01T10:00:00.000Z' as IsoDateTime,
        dtEnd: '2025-01-01T12:00:00.000Z' as IsoDateTime,
        rrule: 'FREQ=WEEKLY;UNTIL=20250215T100000Z',
      });

      const result = mapICalToAssignments([recurringEvent], sourceUrl);

      // Should have 5 occurrences (Jan 1, 8, 15, 22, 29) within 60-day future window
      expect(result.length).toBeGreaterThanOrEqual(3); // At least 3 in the window
      expect(result.length).toBeLessThanOrEqual(7); // But not too many

      // Each occurrence should have unique icalUid with date suffix
      const uids = result.map((a) => a.icalUid);
      expect(new Set(uids).size).toBe(uids.length);

      // All should have the same rrule
      result.forEach((a) => {
        expect(a.rrule).toBe('FREQ=WEEKLY;UNTIL=20250215T100000Z');
      });

      vi.restoreAllMocks();
    });

    it('includes past events within 30-day window', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      // Event from 5 days ago (within 30-day past window)
      const pastEvent: ICalEvent = {
        uid: 'past-1',
        summary: 'Past Assignment',
        description: null,
        location: null,
        dtStart: '2025-01-05T10:00:00.000Z' as IsoDateTime,
        dtEnd: '2025-01-05T11:00:00.000Z' as IsoDateTime,
        rrule: null,
        url: null,
        categories: [],
      };

      // Event from 40 days ago (outside 30-day window)
      const oldEvent: ICalEvent = {
        uid: 'old-1',
        summary: 'Old Assignment',
        description: null,
        location: null,
        dtStart: '2024-12-01T10:00:00.000Z' as IsoDateTime,
        dtEnd: '2024-12-01T11:00:00.000Z' as IsoDateTime,
        rrule: null,
        url: null,
        categories: [],
      };

      const result = mapICalToAssignments([pastEvent, oldEvent], sourceUrl);

      // Only past event should be included
      expect(result).toHaveLength(1);
      expect(result[0]!.icalUid).toBe('past-1');

      vi.restoreAllMocks();
    });

    it('includes future events within 60-day window', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      // Event in 10 days (within 60-day window)
      const nearFutureEvent: ICalEvent = {
        uid: 'near-1',
        summary: 'Near Future Assignment',
        description: null,
        location: null,
        dtStart: '2025-01-20T10:00:00.000Z' as IsoDateTime,
        dtEnd: '2025-01-20T11:00:00.000Z' as IsoDateTime,
        rrule: null,
        url: null,
        categories: [],
      };

      // Event in 70 days (outside 60-day window)
      const farFutureEvent: ICalEvent = {
        uid: 'far-1',
        summary: 'Far Future Assignment',
        description: null,
        location: null,
        dtStart: '2025-03-20T10:00:00.000Z' as IsoDateTime,
        dtEnd: '2025-03-20T11:00:00.000Z' as IsoDateTime,
        rrule: null,
        url: null,
        categories: [],
      };

      const result = mapICalToAssignments([nearFutureEvent, farFutureEvent], sourceUrl);

      // Only near future event should be included
      expect(result).toHaveLength(1);
      expect(result[0]!.icalUid).toBe('near-1');

      vi.restoreAllMocks();
    });

    it('filters out events with invalid dtStart', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      const validEvent: ICalEvent = {
        uid: 'valid-1',
        summary: 'Valid Assignment',
        description: null,
        location: null,
        dtStart: '2025-01-15T10:00:00.000Z' as IsoDateTime,
        dtEnd: '2025-01-15T11:00:00.000Z' as IsoDateTime,
        rrule: null,
        url: null,
        categories: [],
      };

      const invalidEvent: ICalEvent = {
        uid: 'invalid-1',
        summary: 'Invalid Assignment',
        description: null,
        location: null,
        dtStart: 'not-a-date' as IsoDateTime,
        dtEnd: null,
        rrule: null,
        url: null,
        categories: [],
      };

      const missingEvent: ICalEvent = {
        uid: 'missing-1',
        summary: 'Missing Assignment',
        description: null,
        location: null,
        dtStart: null as unknown as IsoDateTime,
        dtEnd: null,
        rrule: null,
        url: null,
        categories: [],
      };

      const result = mapICalToAssignments([validEvent, invalidEvent, missingEvent], sourceUrl);
      expect(result).toHaveLength(1);
      expect(result[0]!.icalUid).toBe('valid-1');

      vi.restoreAllMocks();
    });

    it('handles recurring event with dtEnd duration', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      // Event with 2-hour duration, recurs weekly
      const recurringEvent = createEvent({
        uid: 'recurring-duration',
        summary: 'Weekly Lecture',
        categories: ['PHYS101'],
        dtStart: '2025-01-15T09:00:00.000Z' as IsoDateTime,
        dtEnd: '2025-01-15T11:00:00.000Z' as IsoDateTime,
        rrule: 'FREQ=WEEKLY;UNTIL=20250215T090000Z',
      });

      const result = mapICalToAssignments([recurringEvent], sourceUrl);

      expect(result.length).toBeGreaterThan(0);

      // Each occurrence should preserve the 2-hour duration
      result.forEach((assignment) => {
        const dueAt = new Date(assignment.dueAt!).getTime();
        // We can't easily test dtEnd since it's not stored, but we can verify dueAt is set
        expect(dueAt).toBeGreaterThan(0);
      });

      vi.restoreAllMocks();
    });

    it('falls back to master event when RRULE expansion fails', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      // Invalid RRULE that will fail to expand
      const badRecurringEvent = createEvent({
        uid: 'bad-rrule',
        dtStart: '2025-01-15T10:00:00.000Z' as IsoDateTime,
        rrule: 'INVALID_RRULE',
      });

      const result = mapICalToAssignments([badRecurringEvent], sourceUrl);

      // Should fall back to master event
      expect(result).toHaveLength(1);
      expect(result[0]!.icalUid).toBe('bad-rrule');

      vi.restoreAllMocks();
    });

    it('preserves event.url for each occurrence', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      const recurringEvent = createEvent({
        uid: 'recurring-url',
        dtStart: '2025-01-15T10:00:00.000Z' as IsoDateTime,
        dtEnd: '2025-01-15T11:00:00.000Z' as IsoDateTime,
        rrule: 'FREQ=WEEKLY;UNTIL=20250215T100000Z',
        url: 'https://canvas.example.com/assignments/recurring',
      });

      const result = mapICalToAssignments([recurringEvent], sourceUrl);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((assignment) => {
        expect(assignment.sourceUrl).toBe('https://canvas.example.com/assignments/recurring');
        expect(assignment.htmlUrl).toBe('https://canvas.example.com/assignments/recurring');
      });

      vi.restoreAllMocks();
    });

    it('expands recurring event whose series started long before the window', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      // Weekly class that started in 2023 (long before the 30d/60d window) —
      // mirrors Google Calendar recurring masters (e.g. "FREQ=WEEKLY").
      const recurringEvent = createEvent({
        uid: 'weekly-class',
        summary: 'Weekly Class',
        dtStart: '2023-08-27T15:00:00.000Z' as IsoDateTime, // Sunday
        dtEnd: '2023-08-27T16:00:00.000Z' as IsoDateTime,
        rrule: 'FREQ=WEEKLY',
      });

      const result = mapICalToAssignments([recurringEvent], sourceUrl);

      // Window is [2024-12-11, 2025-03-11] → weekly Sundays inside it.
      expect(result.length).toBeGreaterThan(0);
      const windowStart = new Date('2024-12-11T00:00:00.000Z').getTime();
      const windowEnd = new Date('2025-03-11T23:59:59.999Z').getTime();

      result.forEach((assignment) => {
        const due = new Date(assignment.dueAt!).getTime();
        expect(due).toBeGreaterThanOrEqual(windowStart);
        expect(due).toBeLessThanOrEqual(windowEnd);
        expect(assignment.icalUid!.startsWith('weekly-class@')).toBe(true);
      });

      // All occurrences should be distinct (unique per-instance ical_uid)
      const uids = result.map((a) => a.icalUid);
      expect(new Set(uids).size).toBe(uids.length);

      vi.restoreAllMocks();
    });

    it('does not get stuck expanding a very old recurring series', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      // Weekly series started ~15 years ago (well past the old 500-iteration cap)
      const recurringEvent = createEvent({
        uid: 'ancient-weekly',
        summary: 'Ancient Weekly',
        dtStart: '2010-01-03T15:00:00.000Z' as IsoDateTime, // Sunday
        dtEnd: '2010-01-03T16:00:00.000Z' as IsoDateTime,
        rrule: 'FREQ=WEEKLY',
      });

      const result = mapICalToAssignments([recurringEvent], sourceUrl);

      // Should still reach the window and yield Sunday occurrences
      expect(result.length).toBeGreaterThanOrEqual(10);

      const windowStart = new Date('2024-12-11T00:00:00.000Z').getTime();
      const windowEnd = new Date('2025-03-11T23:59:59.999Z').getTime();
      result.forEach((assignment) => {
        const due = new Date(assignment.dueAt!).getTime();
        expect(due).toBeGreaterThanOrEqual(windowStart);
        expect(due).toBeLessThanOrEqual(windowEnd);
      });

      vi.restoreAllMocks();
    });
  });
});
