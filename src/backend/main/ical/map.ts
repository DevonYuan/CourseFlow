/**
 * iCal Event to Assignment Mapper
 *
 * Transforms parsed ICalEvent[] into AssignmentInput[] ready for database insertion.
 * Pure functions with zero side effects — no I/O, no external dependencies.
 *
 * @module @backend/main/ical/map
 */

import type { ICalEvent, AssignmentInput, EntityId, IsoDateTime } from '@backend/shared/types';
import ICAL from 'ical.js';

import { getDateWindow } from './date-window.js';

/**
 * Safety cap for how many occurrences a single recurring event may be
 * expanded to. Iteration starts at the series DTSTART and walks forward, so a
 * series that began years ago (daily/weekly) still needs enough room to reach
 * the window. We break as soon as an occurrence passes windowEnd.
 */
const MAX_RECURRENCE_ITERATIONS = 10_000;

/**
 * Generates a deterministic hex color from a course name.
 * Uses a simple string hash to derive a hue, then converts HSL to hex.
 * Same course name will always produce the same color.
 *
 * @param courseName - The course name to generate a color for
 * @returns Hex color string (e.g., "#RRGGBB")
 */
export function generateCourseColor(courseName: string): string {
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = (courseName.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  // Convert HSL to hex
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Use saturation 65%, lightness 45% for good visibility on both light/dark backgrounds
  return hslToHex(hue, 65, 45);
}

/**
 * Converts an ISO 8601 UTC string to an ICAL.Time object.
 */
function isoToIcalTime(isoString: string): ICAL.Time {
  // Parse ISO string: 2025-03-15T18:00:00.000Z
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Invalid ISO date string: ${isoString}`);
  }
  const [, year, month, day, hour, minute, second] = match;
  const parts = [year, month, day, hour, minute, second].map((p) =>
    p === undefined ? Number.NaN : Number(p),
  );
  const [parsedYear, parsedMonth, parsedDay, parsedHour, parsedMinute, parsedSecond] = parts;
  if (parts.some((p) => Number.isNaN(p))) {
    throw new Error(`Invalid ISO date string: ${isoString}`);
  }

  return new ICAL.Time(
    {
      year: parsedYear,
      month: parsedMonth,
      day: parsedDay,
      hour: parsedHour,
      minute: parsedMinute,
      second: parsedSecond,
      isDate: false,
    },
    ICAL.Timezone.utcTimezone,
  );
}

/**
 * Converts an ICAL.Time to UTC ISO 8601 string with milliseconds.
 */
function icalTimeToIso(time: ICAL.Time): IsoDateTime {
  if (time.isDate) {
    // Match parse.ts: all-day (date-only) values use 12:00 UTC so the date is
    // stable across timezones.
    const year = time.year;
    const month = String(time.month).padStart(2, '0');
    const day = String(time.day).padStart(2, '0');
    return `${year}-${month}-${day}T12:00:00.000Z` as IsoDateTime;
  }

  // Convert to UTC if needed
  let utcTime = time;
  if (time.zone && time.zone.tzid !== 'UTC' && time.zone.tzid !== 'floating') {
    try {
      utcTime = time.convertToZone(ICAL.Timezone.utcTimezone);
    } catch {
      // Fallback to original time
    }
  }

  const year = utcTime.year;
  const month = String(utcTime.month).padStart(2, '0');
  const day = String(utcTime.day).padStart(2, '0');
  const hour = String(utcTime.hour).padStart(2, '0');
  const minute = String(utcTime.minute).padStart(2, '0');
  const second = String(utcTime.second).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z` as IsoDateTime;
}

/**
 * Expands a recurring event (with RRULE) into individual occurrences within the date window.
 * Uses ical.js RecurIterator for RFC 5545 compliant expansion.
 *
 * @param event - The ICalEvent with RRULE
 * @param windowStart - Start of the window (inclusive)
 * @param windowEnd - End of the window (inclusive)
 * @returns Array of occurrence ISO date strings within the window
 */
function expandRecurringEvent(
  event: ICalEvent,
  windowStart: Date,
  windowEnd: Date
): IsoDateTime[] {
  if (!event.rrule || !event.dtStart) {
    return [];
  }

  try {
    // Parse the RRULE string using fromString static method
    const recur = ICAL.Recur.fromString(event.rrule);

    // Create iterator starting from dtStart
    const dtStart = isoToIcalTime(event.dtStart);

    // For RecurIterator, we need to provide the rule and dtstart in the correct format
    // The iterator options can be an object with rule and dtstart properties
    const iterator = new ICAL.RecurIterator({
      rule: recur,
      dtstart: dtStart,
    });

    const occurrences: IsoDateTime[] = [];
    let next: ICAL.Time | null = null;
    const windowStartMs = windowStart.getTime();
    const windowEndMs = windowEnd.getTime();

    for (let i = 0; i < MAX_RECURRENCE_ITERATIONS; i++) {
      try {
        next = iterator.next();
      } catch (iteratorError) {
        // RecurIterator may throw on malformed rules or edge cases
        console.warn('[iCal Map] RecurIterator error for event:', event.uid, iteratorError);
        break;
      }
      if (!next) break; // No more occurrences

      const occurrenceStart = icalTimeToIso(next);
      const occurrenceTime = new Date(occurrenceStart).getTime();

      // Check if occurrence is within our window
      if (occurrenceTime > windowEndMs) {
        // Past the future window - stop iterating
        break;
      }

      if (occurrenceTime >= windowStartMs) {
        // Within window - add it
        occurrences.push(occurrenceStart);
      }
      // If before windowStart, continue to next occurrence
    }

    return occurrences;
  } catch (error) {
    console.warn('[iCal Map] Failed to expand recurring event:', event.uid, error);
    return [];
  }
}

/**
 * Regular expression to match course codes in CATEGORIES.
 * Matches patterns like: CS101, MATH201, ENG1010, PHYS1001, etc.
 * - 2-4 uppercase letters followed by 3-4 digits
 */
const COURSE_CODE_REGEX = /^[A-Z]{2,4}\d{3,4}$/;

/**
 * Extracts a course name from an ICalEvent using a priority-based heuristic.
 *
 * Priority order:
 * 1. First CATEGORIES entry that matches a course code pattern (e.g., "CS101", "MATH201")
 * 2. Parse from SUMMARY prefix: "[COURSE] Title" or "COURSE: Title"
 * 3. Fallback: "Unknown Course"
 *
 * @param event - The ICalEvent to extract course name from
 * @returns Extracted course name string
 */
export function extractCourseName(event: ICalEvent): string {
  // Priority 1: Check CATEGORIES for a course code pattern
  if (event.categories && event.categories.length > 0) {
    for (const category of event.categories) {
      const trimmed = category.trim();
      if (COURSE_CODE_REGEX.test(trimmed)) {
        return trimmed;
      }
    }
  }

  // Priority 2: Parse from SUMMARY prefix
  // Pattern 1: [COURSE] Title
  const bracketMatch = event.summary.match(/^\s*\[([^\]]+)\]\s*/);
  if (bracketMatch && bracketMatch[1]) {
    const potentialCourse = bracketMatch[1].trim();
    if (potentialCourse.length > 0) {
      return potentialCourse;
    }
  }

  // Pattern 2: COURSE: Title (course code followed by colon and space)
  const colonMatch = event.summary.match(/^\s*([A-Z]{2,4}\d{3,4})\s*:\s*/);
  if (colonMatch && colonMatch[1]) {
    return colonMatch[1].trim();
  }

  // Priority 3: Fallback
  return 'Unknown Course';
}

/**
 * Calculates numeric priority based on days until due date.
 * Sooner due date = higher priority (lower number = higher priority).
 *
 * @param dueDateIso - Due date as ISO 8601 UTC string
 * @param now - Current time in milliseconds (defaults to Date.now())
 * @returns Numeric priority (0 = overdue/highest, 999 = far future/lowest)
 */
function calculateNumericPriority(dueDateIso: string | null, now: number = Date.now()): number {
  if (!dueDateIso) return 999;

  const dueDate = new Date(dueDateIso).getTime();
  if (Number.isNaN(dueDate)) return 999;

  const diffMs = dueDate - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Clamp: 0 (overdue) to 999 (far future)
  if (diffDays < 0) return 0;
  if (diffDays > 999) return 999;
  return diffDays;
}

/**
 * Maps numeric priority to the Assignment priority enum.
 * - Overdue (0 days) → 'high'
 * - Due soon (1-7 days) → 'medium'
 * - Future (8+ days) → 'low'
 *
 * @param numericPriority - Numeric priority from calculateNumericPriority
 * @returns Priority enum value
 */
function mapPriorityToEnum(numericPriority: number): 'low' | 'medium' | 'high' {
  if (numericPriority === 0) return 'high'; // Overdue
  if (numericPriority <= 7) return 'medium'; // Due within a week
  return 'low'; // Due later
}

/**
 * Generates a UUID v4 string for use as EntityId.
 */
function generateEntityId(): EntityId {
  // Simple UUID v4 generation using crypto.randomUUID if available, fallback to Math.random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID() as EntityId;
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as EntityId;
}

/**
 * Gets current time as ISO 8601 UTC string.
 */
function getCurrentIsoTime(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

/**
 * Maps an array of parsed ICalEvent objects to AssignmentInput objects
 * ready for database insertion via the repository.
 *
 * Filters events to keep:
 * - Past 30 days (recent history)
 * - Future 60 days (upcoming events)
 * Expands recurring events (RRULE) into individual occurrences within the window.
 *
 * @param events - Array of parsed ICalEvent objects
 * @param sourceUrl - The iCal feed URL these events were fetched from
 * @returns Array of AssignmentInput objects
 *
 * @example
 * ```typescript
 * const events = parseICalFeed(icalText);
 * const assignments = mapICalToAssignments(events, 'https://canvas.example.com/feed.ics');
 * // assignments ready for repository.upsertAssignments(assignments)
 * ```
 */
export function mapICalToAssignments(events: ICalEvent[], sourceUrl: string): AssignmentInput[] {
  const now = Date.now();
  const currentIsoTime = getCurrentIsoTime();

  // Date window: past 30 days + future 60 days (shared with repository pruning)
  const { start: windowStart, end: windowEnd } = getDateWindow(now);

  const assignments: AssignmentInput[] = [];

  for (const event of events) {
    // Skip events with invalid/missing due dates
    if (!event.dtStart) continue;
    const eventTime = new Date(event.dtStart).getTime();
    if (Number.isNaN(eventTime)) continue;

    const courseName = extractCourseName(event);
    const courseColor = generateCourseColor(courseName);
    const assignmentSourceUrl = event.url ?? sourceUrl;

    // For recurring events, expand into individual occurrences
    if (event.rrule) {
      const occurrences = expandRecurringEvent(event, windowStart, windowEnd);

      for (const occurrenceStart of occurrences) {
        const numericPriority = calculateNumericPriority(occurrenceStart, now);
        const priority = mapPriorityToEnum(numericPriority);

        assignments.push({
          id: generateEntityId(),
          title: event.summary.trim(),
          description: event.description ?? undefined,
          courseName,
          courseColor,
          dueAt: occurrenceStart,
          unlockAt: null,
          lockAt: null,
          pointsPossible: null,
          submissionTypes: [],
          workflowState: 'published',
          htmlUrl: event.url ?? '',
          icalUid: `${event.uid}@${occurrenceStart}`, // Unique ID per occurrence
          priority,
          status: 'pending',
          source: 'ical',
          sourceUrl: assignmentSourceUrl,
          rrule: event.rrule, // Keep RRULE for reference
          createdAt: currentIsoTime,
          updatedAt: currentIsoTime,
        });
      }

      // If no occurrences in window but master event is in window, include master
      // (This handles edge cases where RRULE expansion yields no results but event is in window)
      if (occurrences.length === 0 && eventTime >= windowStart.getTime() && eventTime <= windowEnd.getTime()) {
        const dueAt = event.dtStart;
        const numericPriority = calculateNumericPriority(dueAt, now);
        const priority = mapPriorityToEnum(numericPriority);

        assignments.push({
          id: generateEntityId(),
          title: event.summary.trim(),
          description: event.description ?? undefined,
          courseName,
          courseColor,
          dueAt,
          unlockAt: null,
          lockAt: null,
          pointsPossible: null,
          submissionTypes: [],
          workflowState: 'published',
          htmlUrl: event.url ?? '',
          icalUid: event.uid,
          priority,
          status: 'pending',
          source: 'ical',
          sourceUrl: assignmentSourceUrl,
          rrule: event.rrule ?? undefined,
          createdAt: currentIsoTime,
          updatedAt: currentIsoTime,
        });
      }
    } else {
      // Non-recurring event: check if within window
      if (eventTime >= windowStart.getTime() && eventTime <= windowEnd.getTime()) {
        const numericPriority = calculateNumericPriority(event.dtStart, now);
        const priority = mapPriorityToEnum(numericPriority);

        assignments.push({
          id: generateEntityId(),
          title: event.summary.trim(),
          description: event.description ?? undefined,
          courseName,
          courseColor,
          dueAt: event.dtStart,
          unlockAt: null,
          lockAt: null,
          pointsPossible: null,
          submissionTypes: [],
          workflowState: 'published',
          htmlUrl: event.url ?? '',
          icalUid: event.uid,
          priority,
          status: 'pending',
          source: 'ical',
          sourceUrl: assignmentSourceUrl,
          rrule: undefined,
          createdAt: currentIsoTime,
          updatedAt: currentIsoTime,
        });
      }
    }
  }

  return assignments;
}