/**
 * User-Friendly Error Message Mapping
 *
 * Maps backend error codes to user-friendly messages.
 * Used by useAssignments hook and other components.
 *
 * @module @frontend/utils/errorMessages
 */

/**
 * Error codes from backend IPC handlers.
 * Should match IpcErrorCode in @backend/shared/ipc and iCal fetch/parse errors.
 */
export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'TIMEOUT_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Maps error codes to user-friendly messages.
 * Keys should match error codes thrown by backend services.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NETWORK_ERROR: 'Network error. Check your internet connection.',
  HTTP_ERROR: 'Failed to fetch calendar. The URL may be incorrect.',
  TIMEOUT_ERROR: 'Request timed out. Try again.',
  PARSE_ERROR: 'Invalid calendar format. Check the iCal URL.',
  VALIDATION_ERROR: 'Invalid URL. Must be a valid http/https URL.',
  NOT_FOUND: 'Resource not found.',
  CONFLICT: 'A conflict occurred. Please try again.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Default fallback message for unknown error codes.
 */
export const DEFAULT_ERROR_MESSAGE = ERROR_MESSAGES.UNKNOWN_ERROR;

/**
 * Gets a user-friendly error message for a given error code.
 * Falls back to DEFAULT_ERROR_MESSAGE if code is not recognized.
 *
 * @param code - Error code from backend
 * @returns User-friendly error message
 */
export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code as ErrorCode] ?? DEFAULT_ERROR_MESSAGE;
}

/**
 * Maps an Error object or unknown error to a user-friendly message.
 * Attempts to extract error code from error.name or error.message.
 *
 * @param error - Error object or unknown value
 * @returns User-friendly error message
 */
export function mapErrorToMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check if error name matches known error codes
    const errorName = error.name as ErrorCode;
    if (ERROR_MESSAGES[errorName]) {
      return ERROR_MESSAGES[errorName];
    }
    // Check for specific error class names from iCal module
    if (error.name === 'NetworkError') return ERROR_MESSAGES.NETWORK_ERROR;
    if (error.name === 'HttpError') return ERROR_MESSAGES.HTTP_ERROR;
    if (error.name === 'TimeoutError') return ERROR_MESSAGES.TIMEOUT_ERROR;
    if (error.name === 'ICalParseError' || error.name === 'ICalFetchError') {
      return ERROR_MESSAGES.PARSE_ERROR;
    }
    // Fall back to error message if no code match
    return error.message || DEFAULT_ERROR_MESSAGE;
  }
  return DEFAULT_ERROR_MESSAGE;
}
