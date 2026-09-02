/**
 * iCal Feed Fetcher
 *
 * Robust utility for fetching Canvas iCal feeds with timeout, retry, and typed errors.
 * Pure TypeScript — uses global `fetch` (Node 24+).
 *
 * @module @backend/main/ical/fetch
 */
import type { ICalEvent } from '@backend/shared/types';
/**
 * Configuration options for fetchICalFeed.
 */
export interface FetchICalOptions {
    /** Request timeout in milliseconds. Default: 15000 (15 seconds). */
    timeoutMs?: number;
    /** Maximum number of retry attempts. Default: 3. */
    maxRetries?: number;
    /** Base delay for exponential backoff in milliseconds. Default: 1000 (1 second). */
    baseRetryDelayMs?: number;
    /** Maximum number of redirects to follow. Default: 5. */
    maxRedirects?: number;
    /** Custom User-Agent string. Default includes app name and version. */
    userAgent?: string;
}
/**
 * Base error class for all iCal fetch errors.
 */
export declare class ICalFetchError extends Error {
    readonly cause?: Error;
    constructor(message: string, cause?: Error);
}
/**
 * Network-level errors (DNS failure, connection refused, etc.).
 */
export declare class NetworkError extends ICalFetchError {
    constructor(message: string, cause?: Error);
}
/**
 * HTTP errors (4xx, 5xx status codes).
 */
export declare class HttpError extends ICalFetchError {
    readonly status: number;
    constructor(message: string, status: number, cause?: Error);
}
/**
 * Timeout errors (request exceeded configured timeout).
 */
export declare class TimeoutError extends ICalFetchError {
    constructor(message: string, cause?: Error);
}
/**
 * Fetches a Canvas iCal feed with timeout, retry, and proper error handling.
 *
 * @param url - The iCal feed URL to fetch
 * @param options - Optional configuration (timeout, retries, etc.)
 * @returns The raw iCal text content
 * @throws {NetworkError} On network-level failures (after retries exhausted)
 * @throws {HttpError} On HTTP 4xx/5xx responses
 * @throws {TimeoutError} On request timeout
 * @throws {ICalFetchError} On other unexpected errors
 */
export declare function fetchICalFeed(url: string, options?: FetchICalOptions): Promise<string>;
export declare function parseICalFeed(icalText: string): ICalEvent[];
/**
 * Fetches and parses an iCal feed in one call.
 *
 * @param url - The iCal feed URL to fetch
 * @param options - Optional fetch configuration
 * @returns Array of parsed ICalEvent objects
 */
export declare function fetchAndParseICalFeed(url: string, options?: FetchICalOptions): Promise<ICalEvent[]>;
//# sourceMappingURL=fetch.d.ts.map