/**
 * errorMessages Utility Tests
 *
 * Tests for error code to user-friendly message mapping.
 */

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';

import {
  ERROR_MESSAGES,
  DEFAULT_ERROR_MESSAGE,
  getErrorMessage,
  mapErrorToMessage,
  type ErrorCode,
} from '../utils/errorMessages';

describe('errorMessages', () => {
  describe('ERROR_MESSAGES', () => {
    it('has all required error codes', () => {
      const requiredCodes: ErrorCode[] = [
        'NETWORK_ERROR',
        'HTTP_ERROR',
        'TIMEOUT_ERROR',
        'PARSE_ERROR',
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'CONFLICT',
        'INTERNAL_ERROR',
        'UNKNOWN_ERROR',
      ];

      requiredCodes.forEach((code) => {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(typeof ERROR_MESSAGES[code]).toBe('string');
        expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      });
    });

    it('has user-friendly messages', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR).toBe('Network error. Check your internet connection.');
      expect(ERROR_MESSAGES.HTTP_ERROR).toBe('Failed to fetch calendar. The URL may be incorrect.');
      expect(ERROR_MESSAGES.TIMEOUT_ERROR).toBe('Request timed out. Try again.');
      expect(ERROR_MESSAGES.PARSE_ERROR).toBe('Invalid calendar format. Check the iCal URL.');
      expect(ERROR_MESSAGES.VALIDATION_ERROR).toBe('Invalid URL. Must be a valid http/https URL.');
      expect(ERROR_MESSAGES.NOT_FOUND).toBe('Resource not found.');
      expect(ERROR_MESSAGES.CONFLICT).toBe('A conflict occurred. Please try again.');
      expect(ERROR_MESSAGES.INTERNAL_ERROR).toBe('An unexpected error occurred. Please try again.');
      expect(ERROR_MESSAGES.UNKNOWN_ERROR).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('DEFAULT_ERROR_MESSAGE', () => {
    it('matches UNKNOWN_ERROR message', () => {
      expect(DEFAULT_ERROR_MESSAGE).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
    });
  });

  describe('getErrorMessage', () => {
    it('returns correct message for known error codes', () => {
      expect(getErrorMessage('NETWORK_ERROR')).toBe(
        'Network error. Check your internet connection.',
      );
      expect(getErrorMessage('HTTP_ERROR')).toBe(
        'Failed to fetch calendar. The URL may be incorrect.',
      );
      expect(getErrorMessage('TIMEOUT_ERROR')).toBe('Request timed out. Try again.');
      expect(getErrorMessage('PARSE_ERROR')).toBe('Invalid calendar format. Check the iCal URL.');
      expect(getErrorMessage('VALIDATION_ERROR')).toBe(
        'Invalid URL. Must be a valid http/https URL.',
      );
    });

    it('returns default message for unknown error codes', () => {
      expect(getErrorMessage('UNKNOWN_CODE')).toBe(DEFAULT_ERROR_MESSAGE);
      expect(getErrorMessage('')).toBe(DEFAULT_ERROR_MESSAGE);
      expect(getErrorMessage('RANDOM')).toBe(DEFAULT_ERROR_MESSAGE);
    });
  });

  describe('mapErrorToMessage', () => {
    it('maps Error objects by name', () => {
      const networkError = new Error('Network failed');
      networkError.name = 'NetworkError';
      expect(mapErrorToMessage(networkError)).toBe(
        'Network error. Check your internet connection.',
      );

      const httpError = new Error('HTTP failed');
      httpError.name = 'HttpError';
      expect(mapErrorToMessage(httpError)).toBe(
        'Failed to fetch calendar. The URL may be incorrect.',
      );

      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      expect(mapErrorToMessage(timeoutError)).toBe('Request timed out. Try again.');

      const parseError = new Error('Parse failed');
      parseError.name = 'ICalParseError';
      expect(mapErrorToMessage(parseError)).toBe('Invalid calendar format. Check the iCal URL.');

      const fetchError = new Error('Fetch failed');
      fetchError.name = 'ICalFetchError';
      expect(mapErrorToMessage(fetchError)).toBe('Invalid calendar format. Check the iCal URL.');
    });

    it('falls back to error message if no name match', () => {
      const customError = new Error('Custom error message');
      customError.name = 'CustomError';
      expect(mapErrorToMessage(customError)).toBe('Custom error message');
    });

    it('returns default message for non-Error values', () => {
      expect(mapErrorToMessage(null)).toBe(DEFAULT_ERROR_MESSAGE);
      expect(mapErrorToMessage(undefined)).toBe(DEFAULT_ERROR_MESSAGE);
      expect(mapErrorToMessage('string error')).toBe(DEFAULT_ERROR_MESSAGE);
      expect(mapErrorToMessage(123)).toBe(DEFAULT_ERROR_MESSAGE);
      expect(mapErrorToMessage({})).toBe(DEFAULT_ERROR_MESSAGE);
    });

    it('returns default message for Error with empty message', () => {
      // eslint-disable-next-line unicorn/error-message -- testing empty error message
      const emptyError = new Error('');
      expect(mapErrorToMessage(emptyError)).toBe(DEFAULT_ERROR_MESSAGE);
    });
  });
});
