/**
 * iCal Feed Parser
 *
 * Parses raw iCal text into structured ICalEvent objects using ical.js.
 * Handles RFC 5545 compliance including timezones, recurrence rules, and line folding.
 *
 * @module @backend/main/ical/parse
 */
import type { ICalEvent } from '@backend/shared/types';
/**
 * Custom error class for iCal parsing errors.
 */
export declare class ICalParseError extends Error {
    readonly cause?: Error;
    readonly line?: number;
    constructor(message: string, cause?: Error, line?: number);
}
/**
 * Parses raw iCal text into an array of ICalEvent objects.
 *
 * @param icalText - Raw iCal feed text (RFC 5545 format)
 * @returns Array of parsed ICalEvent objects (one per VEVENT)
 * @throws {ICalParseError} If the iCal text is malformed or cannot be parsed
 *
 * @example
 * ```typescript
 * const icalText = `BEGIN:VCALENDAR
 * VERSION:2.0
 * BEGIN:VEVENT
 * UID:test-123
 * SUMMARY:Test Assignment
 * DTSTART:20250115T143000Z
 * END:VEVENT
 * END:VCALENDAR`;
 * const events = parseICalFeed(icalText);
 * console.log(events[0].summary); // "Test Assignment"
 * ```
 */
export declare function parseICalFeed(icalText: string): ICalEvent[];
/**
 * Parses an iCal feed and returns events with additional metadata.
 * Useful for debugging and validation.
 */
export interface ParseResult {
    events: ICalEvent[];
    skippedCount: number;
    totalVevents: number;
}
export declare function parseICalFeedWithMeta(icalText: string): ParseResult;
//# sourceMappingURL=parse.d.ts.map