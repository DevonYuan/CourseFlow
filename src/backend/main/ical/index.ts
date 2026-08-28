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
  parseICalFeed,
  FetchICalOptions,
  ICalFetchError,
  NetworkError,
  HttpError,
  TimeoutError,
} from './fetch.js';

export type { FetchICalOptions } from './fetch.js';