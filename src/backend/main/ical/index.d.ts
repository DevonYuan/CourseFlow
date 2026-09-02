/**
 * iCal Module — Barrel Export
 *
 * Public API for iCal feed fetching, parsing, and mapping.
 *
 * @module @backend/main/ical
 */
export { fetchICalFeed, fetchAndParseICalFeed, ICalFetchError, NetworkError, HttpError, TimeoutError, } from './fetch.js';
export { parseICalFeed, parseICalFeedWithMeta, ICalParseError, } from './parse.js';
export { mapICalToAssignments, extractCourseName, generateCourseColor, } from './map.js';
export type { FetchICalOptions } from './fetch.js';
export type { ParseResult } from './parse.js';
export type { ICalEvent } from '@backend/shared/types';
//# sourceMappingURL=index.d.ts.map