/**
 * iCal Module — Barrel Export
 *
 * Public API for iCal feed fetching, parsing, and mapping.
 *
 * @module @backend/main/ical
 */

export {
  fetchICalFeed,
  fetchAndParseICalFeed,
  FetchICalOptions,
  ICalFetchError,
  NetworkError,
  HttpError,
  TimeoutError,
} from './fetch.js';

export {
  parseICalFeed,
  parseICalFeedWithMeta,
  ICalParseError,
} from './parse.js';

export {
  mapICalToAssignments,
  extractCourseName,
  generateCourseColor,
} from './map.js';

export type { FetchICalOptions } from './fetch.js';
export type { ICalEvent, ParseResult } from './parse.js';