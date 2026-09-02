/**
 * iCal Feed Parser
 *
 * Parses raw iCal text into structured ICalEvent objects using ical.js.
 * Handles RFC 5545 compliance including timezones, recurrence rules, and line folding.
 *
 * @module @backend/main/ical/parse
 */
import ICAL from 'ical.js';
/**
 * Custom error class for iCal parsing errors.
 */
export class ICalParseError extends Error {
    cause;
    line;
    constructor(message, cause, line) {
        super(message);
        this.name = 'ICalParseError';
        this.cause = cause;
        this.line = line;
    }
}
/**
 * Converts an iCal date-time string (YYYYMMDDTHHMMSSZ) to ISO 8601 with milliseconds.
 * @example "20250315T180000Z" -> "2025-03-15T18:00:00.000Z"
 */
function icalDateTimeToIso(icalDateTime) {
    // Format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
    const match = icalDateTime.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (!match)
        return icalDateTime; // Return as-is if format doesn't match
    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}
/**
 * Converts an ICAL.Time to UTC ISO 8601 string with milliseconds.
 * Handles both date-only and date-time values, and applies timezone conversion.
 */
function icalTimeToUtcIso(time) {
    // Check if it's a date-only value (no time component)
    if (time.isDate) {
        // For date-only, format as YYYY-MM-DDT00:00:00.000Z
        const year = time.year;
        const month = String(time.month).padStart(2, '0');
        const day = String(time.day).padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00.000Z`;
    }
    // For date-time with timezone, convert to UTC
    if (time.zone && time.zone.tzid !== 'UTC' && time.zone.tzid !== 'floating') {
        try {
            const utcTime = time.convertToZone(ICAL.Timezone.utcTimezone);
            return icalDateTimeToIso(utcTime.toICALString());
        }
        catch {
            // Fallback to toICALString if conversion fails
            return icalDateTimeToIso(time.toICALString());
        }
    }
    // For UTC or floating times, use toICALString and convert
    return icalDateTimeToIso(time.toICALString());
}
/**
 * Pre-processes iCal text to preserve spaces in folded lines.
 * RFC 5545: folded lines start with a space or tab, which should be preserved when unfolding.
 * ical.js removes the FIRST space after CRLF during unfolding. To preserve a single space,
 * we ensure folded lines have TWO leading spaces (so one remains after unfolding).
 */
function preprocessIcalText(text) {
    // Replace folded lines (newline followed by space/tab) with newline + TWO spaces
    // This ensures ical.js preserves one space when unfolding (it removes the first)
    return text.replace(/\n([ \t])/g, '\n  ');
}
/**
 * Strips trailing garbage after END:VCALENDAR to handle malformed feeds gracefully.
 */
function stripTrailingGarbage(text) {
    const endVcalendarIndex = text.lastIndexOf('END:VCALENDAR');
    if (endVcalendarIndex === -1)
        return text;
    // Include the END:VCALENDAR line and everything before it
    const endOfLine = text.indexOf('\n', endVcalendarIndex);
    if (endOfLine === -1)
        return text.substring(0, endVcalendarIndex + 'END:VCALENDAR'.length);
    return text.substring(0, endOfLine + 1);
}
/**
 * Extracts a property value from an ICAL.Component, handling various value types.
 * Returns the value converted to string, or null if not present.
 */
function getPropertyValue(component, propertyName) {
    const value = component.getFirstPropertyValue(propertyName.toLowerCase());
    if (value === null || value === undefined)
        return null;
    // Handle ICAL.Time objects - convert to UTC ISO 8601 string with milliseconds
    if (value && typeof value === 'object' && 'icalclass' in value && value.icalclass === 'icaltime') {
        return icalTimeToUtcIso(value);
    }
    // Handle ICAL.Recur objects (for RRULE) - convert to string
    if (value && typeof value === 'object' && 'toString' in value) {
        return value.toString();
    }
    // Handle arrays (multi-value properties)
    if (Array.isArray(value)) {
        return value.map(v => String(v)).join(',');
    }
    return String(value);
}
/**
 * Extracts categories from a VEVENT component.
 * CATEGORIES can be a comma-separated list in a single property or multiple properties.
 */
function extractCategories(component) {
    const categories = [];
    // Get all CATEGORIES properties
    const allProps = component.getAllProperties('categories');
    for (const prop of allProps) {
        // Use getValues() to get all comma-separated values in a property
        const values = prop.getValues();
        for (const value of values) {
            if (value) {
                categories.push(String(value).trim());
            }
        }
    }
    // Filter empty strings and deduplicate
    return [...new Set(categories.filter(c => c.length > 0))];
}
/**
 * Extracts description with proper line unfolding.
 * ical.js unfolds lines but doesn't insert spaces between folded lines.
 * RFC 5545: folded lines start with a space, which should be preserved.
 * We pre-process the text to preserve spaces before parsing.
 */
function extractDescription(component) {
    const value = component.getFirstPropertyValue('description');
    if (value === null || value === undefined)
        return null;
    // Normalize only CRLF to LF, preserve multiple consecutive newlines (blank lines)
    return String(value).replace(/\r\n/g, '\n');
}
/**
 * Parses a single VEVENT component into an ICalEvent.
 * Returns null if required fields are missing.
 */
function parseVEvent(component) {
    // Extract required fields
    const uid = getPropertyValue(component, 'uid');
    const summary = getPropertyValue(component, 'summary');
    const dtStart = getPropertyValue(component, 'dtstart');
    if (!uid || !summary || !dtStart) {
        // Skip events missing required fields
        console.debug('[iCal Parse] Skipping VEVENT missing required fields (UID, SUMMARY, or DTSTART)');
        return null;
    }
    // Extract optional fields
    const description = extractDescription(component);
    const location = getPropertyValue(component, 'location');
    const dtEnd = getPropertyValue(component, 'dtend');
    const rrule = getPropertyValue(component, 'rrule');
    const url = getPropertyValue(component, 'url');
    const categories = extractCategories(component);
    // Handle DURATION property if DTEND is missing
    let finalDtEnd = dtEnd;
    if (!finalDtEnd) {
        const durationProp = component.getFirstProperty('duration');
        if (durationProp) {
            const duration = durationProp.getFirstValue();
            const dtStartProp = component.getFirstProperty('dtstart');
            if (duration && dtStartProp && typeof duration === 'object' && 'icalclass' in duration && duration.icalclass === 'icalduration') {
                const dtStartTime = dtStartProp.getFirstValue();
                // ICAL.Duration has addDuration method
                if (dtStartTime && typeof dtStartTime.addDuration === 'function') {
                    try {
                        const endTime = dtStartTime.clone();
                        endTime.addDuration(duration);
                        finalDtEnd = icalTimeToUtcIso(endTime);
                    }
                    catch {
                        // Ignore duration calculation errors
                    }
                }
            }
        }
    }
    return {
        uid,
        summary,
        description,
        location,
        dtStart: dtStart,
        dtEnd: finalDtEnd,
        rrule,
        url,
        categories,
    };
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
export function parseICalFeed(icalText) {
    if (!icalText || typeof icalText !== 'string') {
        throw new ICalParseError('Invalid input: iCal text must be a non-empty string');
    }
    // Pre-process text to preserve folded line spaces and strip trailing garbage
    const processedText = stripTrailingGarbage(preprocessIcalText(icalText));
    let vcalendar;
    try {
        // Use Component.fromString for robust parsing with full RFC 5545 support
        vcalendar = ICAL.Component.fromString(processedText);
    }
    catch (error) {
        throw new ICalParseError(`Failed to parse iCal feed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
    }
    // Verify it's a VCALENDAR component
    if (vcalendar.name !== 'vcalendar') {
        throw new ICalParseError('No VCALENDAR component found in iCal feed');
    }
    // Extract all VEVENT subcomponents
    const vevents = vcalendar.getAllSubcomponents('vevent');
    const events = [];
    for (const vevent of vevents) {
        try {
            const parsed = parseVEvent(vevent);
            if (parsed) {
                events.push(parsed);
            }
        }
        catch (error) {
            // Log but continue parsing other events
            console.debug('[iCal Parse] Failed to parse VEVENT:', error);
        }
    }
    return events;
}
export function parseICalFeedWithMeta(icalText) {
    if (!icalText || typeof icalText !== 'string') {
        throw new ICalParseError('Invalid input: iCal text must be a non-empty string');
    }
    // Pre-process text to preserve folded line spaces and strip trailing garbage
    const processedText = stripTrailingGarbage(preprocessIcalText(icalText));
    let vcalendar;
    try {
        vcalendar = ICAL.Component.fromString(processedText);
    }
    catch (error) {
        if (error instanceof ICalParseError)
            throw error;
        throw new ICalParseError(`Failed to parse iCal feed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
    }
    if (vcalendar.name !== 'vcalendar') {
        throw new ICalParseError('No VCALENDAR component found in iCal feed');
    }
    const vevents = vcalendar.getAllSubcomponents('vevent');
    const events = [];
    let skippedCount = 0;
    for (const vevent of vevents) {
        try {
            const parsed = parseVEvent(vevent);
            if (parsed) {
                events.push(parsed);
            }
            else {
                skippedCount++;
            }
        }
        catch {
            skippedCount++;
        }
    }
    return {
        events,
        skippedCount,
        totalVevents: vevents.length,
    };
}
//# sourceMappingURL=parse.js.map