/**
 * iCal Event to Assignment Mapper
 *
 * Transforms parsed ICalEvent[] into AssignmentInput[] ready for database insertion.
 * Pure functions with zero side effects — no I/O, no external dependencies.
 *
 * @module @backend/main/ical/map
 */

import type { ICalEvent, AssignmentInput, EntityId, IsoDateTime, AssignmentStatus, AssignmentSource } from '@backend/shared/types';

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
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
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
  if (isNaN(dueDate)) return 999;

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
    const r = (Math.random() * 16) | 0;
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
 * Filters out events that are too far in the past (older than 30 days)
 * to avoid cluttering the list with ancient history.
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
 /**
 * Extracts UNTIL date from RRULE string, if present.
 * Returns ISO 8601 string or null if not found/invalid.
 */
function extractUntilFromRrule(rrule: string | null): IsoDateTime | null {
  if (!rrule) return null;
  const match = rrule.match(/UNTIL=(\d{8}T\d{6}Z?)/i);
  if (!match) return null;
  const untilStr = match[1];
  // Convert 20260214T075959Z -> 2026-02-14T07:59:59.000Z
  const isoMatch = untilStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!isoMatch) return null;
  const [, year, month, day, hour, minute, second] = isoMatch;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z` as IsoDateTime;
}

/**
 * Maps an array of parsed ICalEvent objects to AssignmentInput objects
 * ready for database insertion via the repository.
 *
 * Filters out events that are too far in the past (older than 30 days)
 * to avoid cluttering the list with ancient history.
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

  return events
    .filter((event) => {
      // Skip events with invalid/missing due dates
      if (!event.dtStart) return false;
      const eventTime = new Date(event.dtStart).getTime();
      if (isNaN(eventTime)) return false;

      // For recurring events, compute effective dueAt from RRULE UNTIL
      if (event.rrule) {
        const untilDate = extractUntilFromRrule(event.rrule);
        let effectiveDueAt = eventTime;
        if (untilDate && eventTime < now) {
          effectiveDueAt = new Date(untilDate).getTime();
        } else if (eventTime < now) {
          effectiveDueAt = now + 24 * 60 * 60 * 1000;
        }
        // Only keep if effective dueAt is in the future
        return effectiveDueAt >= now;
      }

      // Non-recurring: only keep future events
      return eventTime >= now;
    })
    .map((event) => {
      const courseName = extractCourseName(event);
      const courseColor = generateCourseColor(courseName);
      
      // For recurring events with old master dtStart, use UNTIL date from RRULE
      // or current time + 1 day as dueAt so they appear in the list
      let dueAt = event.dtStart;
      if (event.rrule) {
        const untilDate = extractUntilFromRrule(event.rrule);
        const eventTime = new Date(event.dtStart).getTime();
        if (untilDate && eventTime < now) {
          // Master event is in the past but RRULE has future UNTIL - use UNTIL date
          dueAt = untilDate;
        } else if (eventTime < now) {
          // Master event is in the past and no UNTIL - use near future
          dueAt = new Date(now + 24 * 60 * 60 * 1000).toISOString() as IsoDateTime;
        }
      }
      
      const numericPriority = calculateNumericPriority(dueAt, now);
      const priority = mapPriorityToEnum(numericPriority);

      // Use event.url if available, otherwise fall back to sourceUrl
      const assignmentSourceUrl = event.url ?? sourceUrl;

      return {
        id: generateEntityId(),
        title: event.summary.trim(),
        description: event.description ?? undefined,
        courseName,
        courseColor,
        dueAt, // Use computed dueAt for recurring events
        unlockAt: null, // Not available from iCal
        lockAt: null, // Not available from iCal
        pointsPossible: null, // Not available from iCal
        submissionTypes: [], // Not available from iCal
        workflowState: 'published', // Assume published if in iCal feed
        htmlUrl: event.url ?? '', // Use event URL if available
        icalUid: event.uid,
        priority,
        status: 'pending',
        source: 'ical',
        sourceUrl: assignmentSourceUrl,
        rrule: event.rrule ?? undefined,
        createdAt: currentIsoTime,
        updatedAt: currentIsoTime,
      };
    });
}