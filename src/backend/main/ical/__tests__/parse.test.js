/**
 * Unit tests for iCal parser using ical.js.
 *
 * @module @backend/main/ical/__tests__/parse.test
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseICalFeed, parseICalFeedWithMeta, ICalParseError, } from '../parse.js';
const __dirname = join(fileURLToPath(import.meta.url), '..');
const FIXTURES_DIR = join(__dirname, 'fixtures');
function loadFixture(name) {
    return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}
describe('iCal Parser (ical.js)', () => {
    describe('parseICalFeed', () => {
        it('parses basic VEVENT with all required and optional fields', () => {
            const icalText = loadFixture('basic-event.ics');
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(1);
            const event = events[0];
            expect(event.uid).toBe('canvas-assignment-12345@example.com');
            expect(event.summary).toBe('CS 101 - Homework 1');
            expect(event.description).toBe('Complete Chapter 1 exercises.\n\nDue: 2025-01-15 23:59');
            expect(event.location).toBe('Online');
            expect(event.dtStart).toBe('2025-01-15T23:59:00.000Z');
            expect(event.dtEnd).toBe('2025-01-16T00:59:00.000Z');
            expect(event.rrule).toBe('FREQ=WEEKLY;COUNT=10');
            expect(event.url).toBe('https://canvas.example.com/courses/101/assignments/12345');
            expect(event.categories).toEqual(['CS101', 'Homework']);
        });
        it('handles timezone-aware events and converts to UTC', () => {
            const icalText = loadFixture('timezone-events.ics');
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(2);
            // First event: 2025-03-15 14:00 EDT = 2025-03-15 18:00 UTC
            const event1 = events[0];
            expect(event1.uid).toBe('event-with-tz-001@example.com');
            expect(event1.summary).toBe('Math 201 - Midterm Exam');
            expect(event1.dtStart).toBe('2025-03-15T18:00:00.000Z'); // EDT is UTC-4
            expect(event1.dtEnd).toBe('2025-03-15T20:00:00.000Z');
            expect(event1.location).toBe('Room 205, Science Building');
            expect(event1.categories).toEqual(['MATH201', 'Exam']);
            // Second event: 2025-03-20 10:00 EDT = 2025-03-20 14:00 UTC
            const event2 = events[1];
            expect(event2.uid).toBe('event-with-tz-002@example.com');
            expect(event2.dtStart).toBe('2025-03-20T14:00:00.000Z');
            expect(event2.dtEnd).toBe('2025-03-20T16:00:00.000Z');
            expect(event2.categories).toEqual(['PHYS101', 'Lab']);
        });
        it('handles all-day events (DATE only, no time)', () => {
            const icalText = loadFixture('allday-events.ics');
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(2);
            // First all-day event: 2025-03-10 to 2025-03-15 (exclusive end)
            const event1 = events[0];
            expect(event1.uid).toBe('allday-event-001@example.com');
            expect(event1.summary).toBe('Spring Break - No Classes');
            expect(event1.dtStart).toBe('2025-03-10T00:00:00.000Z');
            expect(event1.dtEnd).toBe('2025-03-15T00:00:00.000Z');
            expect(event1.categories).toEqual(['Holiday']);
            // Second all-day event: no DTEND
            const event2 = events[1];
            expect(event2.uid).toBe('allday-event-002@example.com');
            expect(event2.dtStart).toBe('2025-05-05T00:00:00.000Z');
            expect(event2.dtEnd).toBeNull();
            expect(event2.categories).toEqual(['Exam']);
        });
        it('handles multiple events and skips non-VEVENT components', () => {
            const icalText = loadFixture('multi-events.ics');
            const events = parseICalFeed(icalText);
            // Should only parse 3 VEVENTs, skip VTODO and VJOURNAL
            expect(events).toHaveLength(3);
            expect(events[0].uid).toBe('multi-event-001@example.com');
            expect(events[0].summary).toBe('This is a very long summary that gets folded across multiple lines as per RFC 5545 line folding specification which requires lines to be no longer than 75 octets');
            expect(events[0].description).toContain('This description also gets folded across multiple lines');
            expect(events[1].uid).toBe('multi-event-002@example.com');
            expect(events[1].summary).toBe('Second Event');
            expect(events[2].uid).toBe('multi-event-003@example.com');
            expect(events[2].description).toContain('<p>This is an <strong>HTML</strong> description');
            expect(events[2].categories).toEqual(['CS101', 'Project', 'Group Work']);
        });
        it('handles events with missing optional fields gracefully', () => {
            const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:minimal-event@example.com
SUMMARY:Minimal Event
DTSTART:20250115T143000Z
END:VEVENT
END:VCALENDAR`;
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(1);
            const event = events[0];
            expect(event.uid).toBe('minimal-event@example.com');
            expect(event.summary).toBe('Minimal Event');
            expect(event.description).toBeNull();
            expect(event.location).toBeNull();
            expect(event.dtEnd).toBeNull();
            expect(event.rrule).toBeNull();
            expect(event.url).toBeNull();
            expect(event.categories).toEqual([]);
        });
        it('skips events missing required fields (UID, SUMMARY, DTSTART)', () => {
            const icalText = loadFixture('malformed-missing-dtstart.ics');
            const events = parseICalFeed(icalText);
            // Only the valid event should be parsed
            expect(events).toHaveLength(1);
            expect(events[0].uid).toBe('malformed-002@example.com');
            expect(events[0].summary).toBe('Valid Event');
        });
        it('returns empty array for empty calendar', () => {
            const icalText = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(0);
        });
        it('throws ICalParseError for completely invalid iCal', () => {
            const icalText = 'This is not valid iCal at all';
            expect(() => parseICalFeed(icalText)).toThrow(ICalParseError);
        });
        it('throws ICalParseError for missing VCALENDAR', () => {
            const icalText = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR'; // No VEVENTs but valid VCALENDAR
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(0);
        });
        it('throws ICalParseError for malformed iCal structure', () => {
            const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test@example.com
SUMMARY:Test
DTSTART:20250115T143000Z
END:VEVENT
END:VCALENDAR
EXTRA GARBAGE`;
            // This should still parse - ical.js is tolerant
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(1);
        });
    });
    describe('parseICalFeedWithMeta', () => {
        it('returns events with metadata', () => {
            const icalText = loadFixture('multi-events.ics');
            const result = parseICalFeedWithMeta(icalText);
            expect(result.events).toHaveLength(3);
            expect(result.totalVevents).toBe(3);
            expect(result.skippedCount).toBe(0);
        });
        it('tracks skipped events in metadata', () => {
            const icalText = loadFixture('malformed-missing-dtstart.ics');
            const result = parseICalFeedWithMeta(icalText);
            expect(result.events).toHaveLength(1);
            expect(result.totalVevents).toBe(2);
            expect(result.skippedCount).toBe(1);
        });
        it('throws ICalParseError for invalid input', () => {
            expect(() => parseICalFeedWithMeta('')).toThrow(ICalParseError);
            expect(() => parseICalFeedWithMeta('not ical')).toThrow(ICalParseError);
        });
    });
    describe('ICalParseError', () => {
        it('stores cause and line number', () => {
            const cause = new Error('original error');
            const error = new ICalParseError('parse failed', cause, 42);
            expect(error.message).toBe('parse failed');
            expect(error.cause).toBe(cause);
            expect(error.line).toBe(42);
            expect(error.name).toBe('ICalParseError');
        });
        it('works without optional parameters', () => {
            const error = new ICalParseError('simple error');
            expect(error.message).toBe('simple error');
            expect(error.cause).toBeUndefined();
            expect(error.line).toBeUndefined();
        });
    });
    describe('Edge cases', () => {
        it('handles RRULE with UNTIL date', () => {
            const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:rrule-until@example.com
SUMMARY:Recurring Until Date
DTSTART:20250115T143000Z
RRULE:FREQ=WEEKLY;UNTIL=20250601T000000Z
END:VEVENT
END:VCALENDAR`;
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(1);
            expect(events[0].rrule).toBe('FREQ=WEEKLY;UNTIL=20250601T000000Z');
        });
        it('handles multiple CATEGORIES properties', () => {
            const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:multi-cat@example.com
SUMMARY:Multi Category Event
DTSTART:20250115T143000Z
CATEGORIES:CS101
CATEGORIES:Homework,Project
END:VEVENT
END:VCALENDAR`;
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(1);
            // Should deduplicate and combine
            expect(events[0].categories).toEqual(['CS101', 'Homework', 'Project']);
        });
        it('handles escaped characters in DESCRIPTION', () => {
            const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:escaped@example.com
SUMMARY:Escaped Description
DESCRIPTION:Line 1\\nLine 2\\, with comma\\; and semicolon
DTSTART:20250115T143000Z
END:VEVENT
END:VCALENDAR`;
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(1);
            // ical.js should unescape these
            expect(events[0].description).toContain('Line 1');
            expect(events[0].description).toContain('Line 2');
        });
        it('handles events with DURATION instead of DTEND', () => {
            const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:duration-event@example.com
SUMMARY:Event with Duration
DTSTART:20250115T143000Z
DURATION:PT1H30M
END:VEVENT
END:VCALENDAR`;
            const events = parseICalFeed(icalText);
            expect(events).toHaveLength(1);
            // ical.js calculates DTEND from DTSTART + DURATION
            expect(events[0].dtEnd).toBe('2025-01-15T16:00:00.000Z');
        });
    });
});
//# sourceMappingURL=parse.test.js.map