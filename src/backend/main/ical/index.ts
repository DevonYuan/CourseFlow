/**
 * iCal Module — Barrel Export
 *
 * Public API for iCal feed fetching and parsing.
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

export type { FetchICalOptions } from './fetch.js';
export type { ICalEvent, ParseResult } from './parse.js';