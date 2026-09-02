/**
 * Unit tests for iCal to Assignment mapper.
 *
 * @module @backend/main/ical/__tests__/map.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  mapICalToAssignments,
  extractCourseName,
  generateCourseColor,
} from '../map.js';
import type { ICalEvent, IsoDateTime } from '@backend/shared/types';

// Helper to create a minimal valid ICalEvent
function createEvent(overrides: Partial<ICalEvent> = {}): ICalEvent {
  return {
    uid: 'test-uid-123',
    summary: 'Test Assignment',
    description: 'Test description',
    location: 'Online',
    dtStart: '2025-01-15T23:59:00.000Z' as IsoDateTime,
    dtEnd: '2025-01-16T00:59:00.000Z' as IsoDateTime,
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
          dtStart: '2025-01-15T23:59:00.000Z' as IsoDateTime,
          url: 'https://canvas.example.com/assignments/1',
        }),
      ];

      const result = mapICalToAssignments(events, sourceUrl);

      expect(result).toHaveLength(1);
      const assignment = result[0]!;

      expect(assignment.title).toBe('CS101 - Homework 1');
      expect(assignment.courseName).toBe('CS101');
      expect(assignment.courseColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(assignment.dueAt).toBe('2025-01-15T23:59:00.000Z');
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

    it('calculates priority based on due date (high for overdue, medium for soon, low for future)', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();

      // Overdue event
      const overdueEvent = createEvent({
        uid: 'overdue',
        dtStart: '2025-01-05T12:00:00.000Z' as IsoDateTime,
      });

      // Due soon event
      const dueSoonEvent = createEvent({
        uid: 'due-soon',
        dtStart: '2025-01-12T12:00:00.000Z' as IsoDateTime, // 2 days
      });

      // Far future event
      const farEvent = createEvent({
        uid: 'far',
        dtStart: '2025-02-01T12:00:00.000Z' as IsoDateTime, // 22 days
      });

      // Mock Date.now for consistent results
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      const result = mapICalToAssignments([overdueEvent, dueSoonEvent, farEvent], sourceUrl);

      expect(result[0]!.priority).toBe('high'); // overdue
      expect(result[1]!.priority).toBe('medium'); // due soon (2 days)
      expect(result[2]!.priority).toBe('low'); // far future

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
      const events = [
        createEvent({ uid: 'event-1' }),
        createEvent({ uid: 'event-2' }),
      ];

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

    it('calculates priority based on due date', () => {
      const now = new Date('2025-01-10T12:00:00.000Z').getTime();

      // Overdue event
      const overdueEvent = createEvent({
        uid: 'overdue',
        dtStart: '2025-01-05T12:00:00.000Z' as IsoDateTime,
      });

      // Due soon event
      const dueSoonEvent = createEvent({
        uid: 'due-soon',
        dtStart: '2025-01-12T12:00:00.000Z' as IsoDateTime, // 2 days
      });

      // Far future event
      const farEvent = createEvent({
        uid: 'far',
        dtStart: '2025-02-01T12:00:00.000Z' as IsoDateTime, // 22 days
      });

      // Mock Date.now for consistent results
      vi.spyOn(global.Date, 'now').mockImplementation(() => now);

      const result = mapICalToAssignments([overdueEvent, dueSoonEvent, farEvent], sourceUrl);

      expect(result[0]!.priority).toBe('high'); // overdue
      expect(result[1]!.priority).toBe('medium'); // due soon (2 days)
      expect(result[2]!.priority).toBe('low'); // far future

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
  });
});