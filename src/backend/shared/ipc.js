"use strict";
/**
 * IPC Channel & Event Type Definitions
 *
 * Single source of truth for all inter-process communication.
 * Imported by Main, Preload, and Renderer (via project references).
 *
 * @module @backend/shared/ipc
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcErrorCode = void 0;
/**
 * Standard error codes for programmatic error handling.
 */
exports.IpcErrorCode = {
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    HTTP_ERROR: 'HTTP_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
};
//# sourceMappingURL=ipc.js.map