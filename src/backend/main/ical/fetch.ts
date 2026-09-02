/**
 * iCal Feed Fetcher
 *
 * Robust utility for fetching Canvas iCal feeds with timeout, retry, and typed errors.
 * Pure TypeScript — uses global `fetch` (Node 24+).
 *
 * @module @backend/main/ical/fetch
 */

import type { ICalEvent, IsoDateTime } from '@backend/shared/types';

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
 * Sanitized URL for logging (strips sensitive query parameters).
 */
function sanitizeUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query parameters that might contain tokens/secrets
    const sensitiveParams = ['token', 'access_token', 'api_key', 'secret', 'password', 'auth'];
    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    // Return the URL with redacted params but without double-encoding
    return parsed.toString().replaceAll('%5BREDACTED%5D', '[REDACTED]');
  } catch {
    // If URL parsing fails, return a generic placeholder
    return '[invalid-url]';
  }
}

/**
 * Base error class for all iCal fetch errors.
 */
export class ICalFetchError extends Error {
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ICalFetchError';
    this.cause = cause;
  }
}

/**
 * Network-level errors (DNS failure, connection refused, etc.).
 */
export class NetworkError extends ICalFetchError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'NetworkError';
  }
}

/**
 * HTTP errors (4xx, 5xx status codes).
 */
export class HttpError extends ICalFetchError {
  public readonly status: number;

  constructor(message: string, status: number, cause?: Error) {
    super(message, cause);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Timeout errors (request exceeded configured timeout).
 */
export class TimeoutError extends ICalFetchError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'TimeoutError';
  }
}

/**
 * Default configuration values.
 */
const DEFAULT_OPTIONS: Required<FetchICalOptions> = {
  timeoutMs: 15_000,
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRedirects: 5,
  userAgent: 'CourseFlow/0.1.0 (+https://github.com/courseflow)',
};

/**
 * Delay utility for exponential backoff.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parses an iCal date/time value into ISO 8601 format.
 * Handles various iCal date formats:
 * - DATE only: YYYYMMDD
 * - DATE-TIME: YYYYMMDDTHHMMSSZ or with timezone
 */
function parseICalDateTime(value: string): IsoDateTime {
  // Handle various iCal date formats and convert to ISO 8601
  // Basic format: 20250115T143000Z or 20250115
  // Also handles: DTSTART;VALUE=DATE:20250115 (parameter in property name, not value)
  const cleaned = value.replace(/^.*:/, ''); // Remove any parameter prefix from value
  if (cleaned.length === 8) {
    // DATE only: YYYYMMDD
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00.000Z` as IsoDateTime;
  }
  if (cleaned.length >= 15) {
    // DATE-TIME: YYYYMMDDTHHMMSSZ or with timezone
    const datePart = cleaned.slice(0, 8);
    const timePart = cleaned.slice(9, 15);
    return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}.000Z` as IsoDateTime;
  }
  // Fallback: return as-is if already ISO-like
  return cleaned as IsoDateTime;
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
export async function fetchICalFeed(
  url: string,
  options: FetchICalOptions = {}
): Promise<string> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const sanitizedUrl = sanitizeUrlForLogging(url);

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'text/calendar, text/plain, */*',
        },
      });

      clearTimeout(timeoutId);

      // Handle case where fetch returns undefined (e.g., exhausted mock in tests)
      if (response && typeof response.ok === 'boolean') {
        if (response.ok === false) {
          const error = new HttpError(
            `HTTP ${response.status} ${response.statusText} fetching iCal feed: ${sanitizedUrl} (attempt ${attempt}/${config.maxRetries})`,
            response.status
          );
          // Don't retry on 4xx (client errors) - they won't succeed on retry
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }
          // For 5xx, fall through to retry logic
          lastError = error;
        } else {
          // Validate content-type (warn but don't fail)
          const contentType = response.headers.get('content-type') ?? '';
          if (!contentType.includes('text/calendar') && !contentType.includes('text/plain')) {
            console.warn(
              `[iCal Fetch] Unexpected content-type "${contentType}" for ${sanitizedUrl} (attempt ${attempt})`
            );
          }

          const text = await response.text();
          return text;
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw HttpError immediately (4xx errors) - don't retry
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = new TimeoutError(
          `Request timeout after ${config.timeoutMs}ms fetching iCal feed: ${sanitizedUrl} (attempt ${attempt}/${config.maxRetries})`,
          error
        );
        lastError = timeoutError;
      } else if (error instanceof TypeError) {
        // Network error (DNS, connection refused, etc.) or invalid response
        const networkError = new NetworkError(
          `Network error fetching iCal feed: ${sanitizedUrl} (attempt ${attempt}/${config.maxRetries}): ${error.message}`,
          error
        );
        lastError = networkError;
      } else if (error instanceof ICalFetchError) {
        // Re-throw our own errors (TimeoutError, NetworkError, etc.)
        throw error;
      } else {
        // Unexpected error
        const unexpectedError = new ICalFetchError(
          `Unexpected error fetching iCal feed: ${sanitizedUrl} (attempt ${attempt}/${config.maxRetries}): ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );
        lastError = unexpectedError;
      }
    }

    // Exponential backoff before retry (except on last attempt)
    // Only retry if we have a retryable error (not 4xx which was thrown above)
    if (attempt < config.maxRetries && lastError) {
      const backoffMs = config.baseRetryDelayMs * 2 ** (attempt - 1);
      console.warn(`[iCal Fetch] Retrying in ${backoffMs}ms... (attempt ${attempt + 1}/${config.maxRetries})`);
      await delay(backoffMs);
    } else if (attempt < config.maxRetries && !lastError) {
      // No error to retry (shouldn't happen, but safety)
      break;
    }
  }

  // All retries exhausted - throw the last error with proper type
  if (lastError instanceof HttpError) {
    throw lastError;
  }
  if (lastError instanceof TimeoutError) {
    throw new TimeoutError(
      `Request timeout after ${config.maxRetries} attempts (${config.timeoutMs}ms each) fetching iCal feed: ${sanitizedUrl}`,
      lastError
    );
  }
  if (lastError instanceof NetworkError) {
    throw new NetworkError(
      `Network error after ${config.maxRetries} attempts fetching iCal feed: ${sanitizedUrl}`,
      lastError
    );
  }
  if (lastError instanceof ICalFetchError) {
    throw lastError;
  }
  throw new ICalFetchError(
    `Failed to fetch iCal feed after ${config.maxRetries} attempts: ${sanitizedUrl}`,
    lastError
  );
}

/**
 * Parses raw iCal text into structured ICalEvent objects.
 * This is a minimal parser for the fields we need - for full RFC 5545 compliance
 * a dedicated library would be used, but this covers Canvas's typical output.
 *
 * @param icalText - Raw iCal feed text
 * @returns Array of parsed ICalEvent objects
 */
/**
 * Flushes the current property value into the current event.
 * Returns the updated currentProperty and currentValue (both reset to empty).
 */
function flushProperty(
  currentEvent: Partial<ICalEvent> | null,
  currentProperty: string,
  currentValue: string,
): { currentProperty: string; currentValue: string } {
  if (!currentEvent || !currentProperty) {
    return { currentProperty: '', currentValue: '' };
  }

  const value = currentValue.trim();

  switch (currentProperty.toUpperCase()) {
    case 'UID': {
      currentEvent.uid = value;
      break;
    }
    case 'SUMMARY': {
      currentEvent.summary = value;
      break;
    }
    case 'DESCRIPTION': {
      currentEvent.description = value || null;
      break;
    }
    case 'LOCATION': {
      currentEvent.location = value || null;
      break;
    }
    case 'DTSTART':
    case 'DTSTART;VALUE=DATE-TIME':
    case 'DTSTART;VALUE=DATE': {
      currentEvent.dtStart = parseICalDateTime(value);
      break;
    }
    case 'DTEND':
    case 'DTEND;VALUE=DATE-TIME':
    case 'DTEND;VALUE=DATE': {
      currentEvent.dtEnd = value ? parseICalDateTime(value) : null;
      break;
    }
    case 'RRULE': {
      currentEvent.rrule = value;
      break;
    }
    case 'URL': {
      currentEvent.url = value || null;
      break;
    }
    case 'CATEGORIES': {
      currentEvent.categories = value.split(',').map((c) => c.trim()).filter(Boolean);
      break;
    }
  }

  return { currentProperty: '', currentValue: '' };
}

export function parseICalFeed(icalText: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icalText.split(/\r?\n/);

  // During parsing, dtStart can be empty string before being set to a valid ISO date
type ParsingEvent = Omit<Partial<ICalEvent>, 'dtStart'> & { dtStart: string };

let currentEvent: ParsingEvent | null = null;
  let inEvent = false;
  let currentProperty = '';
  let currentValue = '';

  for (const line of lines) {
    // Handle line folding (RFC 5545: lines can be folded with space/tab continuation)
    // Only append to currentValue if we're currently parsing a property
    if ((line.startsWith(' ') || line.startsWith('\t')) && currentProperty) {
      currentValue += ' ' + line.slice(1);
      continue;
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        uid: '',
        summary: '',
        description: null,
        location: null,
        dtStart: '',
        dtEnd: null,
        rrule: null,
        url: null,
        categories: [],
      };
      continue;
    }

    if (line === 'END:VEVENT') {
      // Flush any pending property before finalizing the event
      if (currentEvent && currentProperty) {
        const value = currentValue.trim();
        switch (currentProperty.toUpperCase()) {
          case 'UID': {
            currentEvent.uid = value;
            break;
          }
          case 'SUMMARY': {
            currentEvent.summary = value;
            break;
          }
          case 'DESCRIPTION': {
            currentEvent.description = value || null;
            break;
          }
          case 'LOCATION': {
            currentEvent.location = value || null;
            break;
          }
          case 'DTSTART':
          case 'DTSTART;VALUE=DATE-TIME':
          case 'DTSTART;VALUE=DATE': {
            currentEvent.dtStart = parseICalDateTime(value);
            break;
          }
          case 'DTEND':
          case 'DTEND;VALUE=DATE-TIME':
          case 'DTEND;VALUE=DATE': {
            currentEvent.dtEnd = value ? parseICalDateTime(value) : null;
            break;
          }
          case 'RRULE': {
            currentEvent.rrule = value;
            break;
          }
          case 'URL': {
            currentEvent.url = value || null;
            break;
          }
          case 'CATEGORIES': {
            currentEvent.categories = value.split(',').map((c) => c.trim()).filter(Boolean);
            break;
          }
        }
      }
      // DEBUG: Log event before push
      if (currentEvent && currentEvent.uid && currentEvent.summary && currentEvent.dtStart !== '') {
        events.push(currentEvent as ICalEvent);
      }
      inEvent = false;
      currentEvent = null;
      currentProperty = '';
      currentValue = '';
      continue;
    }

    if (!inEvent) continue;

    // Parse property line: NAME:VALUE or NAME;PARAM=VAL:VALUE
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    // Flush previous property before starting new one
    if (currentEvent && currentProperty) {
      const value = currentValue.trim();
      switch (currentProperty.toUpperCase()) {
        case 'UID': {
          currentEvent.uid = value;
          break;
        }
        case 'SUMMARY': {
          currentEvent.summary = value;
          break;
        }
        case 'DESCRIPTION': {
          currentEvent.description = value || null;
          break;
        }
        case 'LOCATION': {
          currentEvent.location = value || null;
          break;
        }
        case 'DTSTART':
        case 'DTSTART;VALUE=DATE-TIME':
        case 'DTSTART;VALUE=DATE': {
          currentEvent.dtStart = parseICalDateTime(value);
          break;
        }
        case 'DTEND':
        case 'DTEND;VALUE=DATE-TIME':
        case 'DTEND;VALUE=DATE': {
          currentEvent.dtEnd = value ? parseICalDateTime(value) : null;
          break;
        }
        case 'RRULE': {
          currentEvent.rrule = value;
          break;
        }
        case 'URL': {
          currentEvent.url = value || null;
          break;
        }
        case 'CATEGORIES': {
          currentEvent.categories = value.split(',').map((c) => c.trim()).filter(Boolean);
          break;
        }
      }
    }
    currentProperty = '';
    currentValue = '';

    // Start new property
    currentProperty = line.slice(0, colonIndex);
    currentValue = line.slice(colonIndex + 1);
  }

  // Flush any remaining property (in case file ends without END:VEVENT)
  if (currentEvent && currentProperty) {
    const value = currentValue.trim();
    switch (currentProperty.toUpperCase()) {
      case 'UID': {
        currentEvent.uid = value;
        break;
      }
      case 'SUMMARY': {
        currentEvent.summary = value;
        break;
      }
      case 'DESCRIPTION': {
        currentEvent.description = value || null;
        break;
      }
      case 'LOCATION': {
        currentEvent.location = value || null;
        break;
      }
      case 'DTSTART':
      case 'DTSTART;VALUE=DATE-TIME':
      case 'DTSTART;VALUE=DATE': {
        currentEvent.dtStart = parseICalDateTime(value);
        break;
      }
      case 'DTEND':
      case 'DTEND;VALUE=DATE-TIME':
      case 'DTEND;VALUE=DATE': {
        currentEvent.dtEnd = value ? parseICalDateTime(value) : null;
        break;
      }
      case 'RRULE': {
        currentEvent.rrule = value;
        break;
      }
      case 'URL': {
        currentEvent.url = value || null;
        break;
      }
      case 'CATEGORIES': {
        currentEvent.categories = value.split(',').map((c) => c.trim()).filter(Boolean);
        break;
      }
    }
  }

  return events;
}

/**
 * Fetches and parses an iCal feed in one call.
 *
 * @param url - The iCal feed URL to fetch
 * @param options - Optional fetch configuration
 * @returns Array of parsed ICalEvent objects
 */
export async function fetchAndParseICalFeed(
  url: string,
  options?: FetchICalOptions
): Promise<ICalEvent[]> {
  const text = await fetchICalFeed(url, options);
  return parseICalFeed(text);
}