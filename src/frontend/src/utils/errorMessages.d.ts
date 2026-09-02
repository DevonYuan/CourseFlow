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
export type ErrorCode = 'NETWORK_ERROR' | 'HTTP_ERROR' | 'TIMEOUT_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR' | 'UNKNOWN_ERROR';
/**
 * Maps error codes to user-friendly messages.
 * Keys should match error codes thrown by backend services.
 */
export declare const ERROR_MESSAGES: Record<ErrorCode, string>;
/**
 * Default fallback message for unknown error codes.
 */
export declare const DEFAULT_ERROR_MESSAGE: string;
/**
 * Gets a user-friendly error message for a given error code.
 * Falls back to DEFAULT_ERROR_MESSAGE if code is not recognized.
 *
 * @param code - Error code from backend
 * @returns User-friendly error message
 */
export declare function getErrorMessage(code: string): string;
/**
 * Maps an Error object or unknown error to a user-friendly message.
 * Attempts to extract error code from error.name or error.message.
 *
 * @param error - Error object or unknown value
 * @returns User-friendly error message
 */
export declare function mapErrorToMessage(error: unknown): string;
//# sourceMappingURL=errorMessages.d.ts.map