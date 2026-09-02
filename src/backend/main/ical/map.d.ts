/**
 * iCal Event to Assignment Mapper
 *
 * Transforms parsed ICalEvent[] into AssignmentInput[] ready for database insertion.
 * Pure functions with zero side effects — no I/O, no external dependencies.
 *
 * @module @backend/main/ical/map
 */
import type { ICalEvent, AssignmentInput } from '@backend/shared/types';
/**
 * Generates a deterministic hex color from a course name.
 * Uses a simple string hash to derive a hue, then converts HSL to hex.
 * Same course name will always produce the same color.
 *
 * @param courseName - The course name to generate a color for
 * @returns Hex color string (e.g., "#RRGGBB")
 */
export declare function generateCourseColor(courseName: string): string;
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
export declare function extractCourseName(event: ICalEvent): string;
/**
 * Maps an array of parsed ICalEvent objects to AssignmentInput objects
 * ready for database insertion via the repository.
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
export declare function mapICalToAssignments(events: ICalEvent[], sourceUrl: string): AssignmentInput[];
//# sourceMappingURL=map.d.ts.map