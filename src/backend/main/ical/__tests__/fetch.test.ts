/**
 * Unit tests for iCal fetch utility.
 *
 * @module @backend/main/ical/__tests__/fetch.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

import {
  fetchICalFeed,
  fetchAndParseICalFeed,
  parseICalFeed,
  ICalFetchError,
  NetworkError,
  HttpError,
  TimeoutError,
} from '../fetch.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('iCal Fetch Utility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchICalFeed', () => {
    const testUrl = 'https://canvas.example.com/feeds/ical/abc123.ics';

    it('returns iCal text on successful fetch', async () => {
      const icalText = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/calendar' }),
        text: () => Promise.resolve(icalText),
      });

      const result = await fetchICalFeed(testUrl);
      expect(result).toBe(icalText);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws HttpError on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: () => Promise.resolve('Not Found'),
      });

      await expect(fetchICalFeed(testUrl)).rejects.toThrow(HttpError);
      await expect(fetchICalFeed(testUrl)).rejects.toMatchObject({
        status: 404,
        name: 'HttpError',
      });
    });

    it('throws HttpError on 500', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: () => Promise.resolve('Server Error'),
      });

      await expect(fetchICalFeed(testUrl, { maxRetries: 3, baseRetryDelayMs: 10 })).rejects.toThrow(HttpError);
      await expect(fetchICalFeed(testUrl, { maxRetries: 3, baseRetryDelayMs: 10 })).rejects.toMatchObject({
        status: 500,
      });
    });

    it('retries on 5xx errors with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers(),
          text: () => Promise.resolve('Unavailable'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers(),
          text: () => Promise.resolve('Unavailable'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/calendar' }),
          text: () => Promise.resolve('BEGIN:VCALENDAR\nEND:VCALENDAR'),
        });

      const result = await fetchICalFeed(testUrl, { maxRetries: 3, baseRetryDelayMs: 10 });
      expect(result).toBe('BEGIN:VCALENDAR\nEND:VCALENDAR');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws TimeoutError on request timeout', async () => {
      // Create an AbortError
      const abortError = new DOMException('Aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(fetchICalFeed(testUrl, { timeoutMs: 100, maxRetries: 1 })).rejects.toThrow(TimeoutError);
    });

    it('throws NetworkError on network failure after retries', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      await expect(fetchICalFeed(testUrl, { maxRetries: 2, baseRetryDelayMs: 10 })).rejects.toThrow(NetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(fetchICalFeed(testUrl)).rejects.toThrow(HttpError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('includes User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/calendar' }),
        text: () => Promise.resolve('OK'),
      });

      await fetchICalFeed(testUrl);

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      if (call) {
        const options = call[1] as RequestInit;
        expect(options.headers).toMatchObject({
          'User-Agent': expect.stringContaining('CourseFlow'),
        });
      }
    });

    it('accepts custom timeout', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(fetchICalFeed(testUrl, { timeoutMs: 5000, maxRetries: 1 })).rejects.toThrow(TimeoutError);
    });

    it('sanitizes URL in error messages', async () => {
      const urlWithToken = 'https://canvas.example.com/feeds/ical/abc123.ics?token=secret123';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: () => Promise.resolve('Not Found'),
      });

      try {
        await fetchICalFeed(urlWithToken);
      } catch (error) {
        expect(error instanceof HttpError).toBe(true);
        expect((error as HttpError).message).not.toContain('secret123');
        expect((error as HttpError).message).toContain('[REDACTED]');
      }
    });

    it('warns but does not fail on unexpected content-type', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"data": "test"}'),
      });

      const result = await fetchICalFeed(testUrl);
      expect(result).toBe('{"data": "test"}');
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected content-type')
      );

      consoleWarn.mockRestore();
    });
  });

  describe('parseICalFeed', () => {
    it('parses basic VEVENT with required fields', () => {
      const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-uid-123
SUMMARY:Test Assignment
DTSTART:20250115T143000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICalFeed(icalText);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        uid: 'test-uid-123',
        summary: 'Test Assignment',
        dtStart: '2025-01-15T14:30:00.000Z',
      });
    });

    it('parses optional fields', () => {
      const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-uid-456
SUMMARY:Another Assignment
DESCRIPTION:This is a description
LOCATION:Room 101
DTSTART:20250115T143000Z
DTEND:20250115T160000Z
RRULE:FREQ=WEEKLY;COUNT=10
URL:https://canvas.example.com/assignments/456
CATEGORIES:CS101,Homework
END:VEVENT
END:VCALENDAR`;

      const events = parseICalFeed(icalText);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        uid: 'test-uid-456',
        summary: 'Another Assignment',
        description: 'This is a description',
        location: 'Room 101',
        dtStart: '2025-01-15T14:30:00.000Z',
        dtEnd: '2025-01-15T16:00:00.000Z',
        rrule: 'FREQ=WEEKLY;COUNT=10',
        url: 'https://canvas.example.com/assignments/456',
        categories: ['CS101', 'Homework'],
      });
    });

    it('handles DATE-only DTSTART (all-day events)', () => {
      const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-1
SUMMARY:All Day Event
DTSTART;VALUE=DATE:20250115
END:VEVENT
END:VCALENDAR`;

      const events = parseICalFeed(icalText);
      expect(events).toHaveLength(1);
      expect(events[0]?.dtStart).toBe('2025-01-15T00:00:00.000Z');
    });

    it('returns empty array for empty calendar', () => {
      const icalText = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
      const events = parseICalFeed(icalText);
      expect(events).toHaveLength(0);
    });

    it('handles multiple events', () => {
      const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:First Event
DTSTART:20250115T143000Z
END:VEVENT
BEGIN:VEVENT
UID:event-2
SUMMARY:Second Event
DTSTART:20250116T100000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICalFeed(icalText);
      expect(events).toHaveLength(2);
      expect(events[0]?.uid).toBe('event-1');
      expect(events[1]?.uid).toBe('event-2');
    });

    it('handles folded lines (RFC 5545 line folding)', () => {
      const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:folded-1
SUMMARY:This is a very long summary that gets
 folded across multiple lines
DTSTART:20250115T143000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICalFeed(icalText);
      expect(events).toHaveLength(1);
      expect(events[0]?.summary).toBe('This is a very long summary that gets folded across multiple lines');
    });

    it('skips events missing required fields', () => {
      const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:valid-1
SUMMARY:Valid Event
DTSTART:20250115T143000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Missing UID
DTSTART:20250115T143000Z
END:VEVENT
BEGIN:VEVENT
UID:missing-summary
DTSTART:20250115T143000Z
END:VEVENT
BEGIN:VEVENT
UID:missing-dtstart
SUMMARY:Missing DTSTART
END:VEVENT
END:VCALENDAR`;

      const events = parseICalFeed(icalText);
      expect(events).toHaveLength(1);
      expect(events[0]?.uid).toBe('valid-1');
    });
  });

  describe('fetchAndParseICalFeed', () => {
    it('fetches and parses in one call', async () => {
      const icalText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:combined-1
SUMMARY:Combined Test
DTSTART:20250115T143000Z
END:VEVENT
END:VCALENDAR`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/calendar' }),
        text: () => Promise.resolve(icalText),
      });

      const events = await fetchAndParseICalFeed('https://test.com/feed.ics');
      expect(events).toHaveLength(1);
      expect(events[0]?.uid).toBe('combined-1');
      expect(events[0]?.summary).toBe('Combined Test');
    });

    it('propagates fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      await expect(fetchAndParseICalFeed('https://test.com/feed.ics', { maxRetries: 1 })).rejects.toThrow(NetworkError);
    });
  });

  describe('Error Classes', () => {
    it('ICalFetchError stores cause', () => {
      const cause = new Error('original');
      const error = new ICalFetchError('test message', cause);
      expect(error.message).toBe('test message');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('ICalFetchError');
    });

    it('NetworkError extends ICalFetchError', () => {
      const error = new NetworkError('network failed');
      expect(error).toBeInstanceOf(ICalFetchError);
      expect(error.name).toBe('NetworkError');
    });

    it('HttpError stores status code', () => {
      const error = new HttpError('server error', 500);
      expect(error.status).toBe(500);
      expect(error.name).toBe('HttpError');
    });

    it('TimeoutError extends ICalFetchError', () => {
      const error = new TimeoutError('timed out');
      expect(error).toBeInstanceOf(ICalFetchError);
      expect(error.name).toBe('TimeoutError');
    });
  });
});