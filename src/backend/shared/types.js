"use strict";
/**
 * Core Domain Types
 *
 * Pure TypeScript — zero Electron/Node dependencies.
 * Used across Main, Preload, and Renderer via project references.
 *
 * @module @backend/shared/types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidAssignment = isValidAssignment;
exports.isValidSubTaskInput = isValidSubTaskInput;
exports.isValidNoteInput = isValidNoteInput;
exports.isValidPriorityOrderInput = isValidPriorityOrderInput;
exports.isValidSettings = isValidSettings;
/**
 * Type guards for runtime validation (used in Main handlers).
 */
function isValidAssignment(input) {
    if (!input || typeof input !== 'object')
        return false;
    const obj = input;
    // Only id is required for upsert
    if (typeof obj['id'] !== 'string')
        return false;
    // All other fields are optional, but if present must be correct type
    if (obj['title'] !== undefined && typeof obj['title'] !== 'string')
        return false;
    if (obj['description'] !== undefined && typeof obj['description'] !== 'string')
        return false;
    if (obj['courseId'] !== undefined && typeof obj['courseId'] !== 'string')
        return false;
    if (obj['courseName'] !== undefined && typeof obj['courseName'] !== 'string')
        return false;
    if (obj['courseColor'] !== undefined && typeof obj['courseColor'] !== 'string')
        return false;
    if (obj['dueAt'] !== undefined && obj['dueAt'] !== null && typeof obj['dueAt'] !== 'string')
        return false;
    if (obj['unlockAt'] !== undefined && obj['unlockAt'] !== null && typeof obj['unlockAt'] !== 'string')
        return false;
    if (obj['lockAt'] !== undefined && obj['lockAt'] !== null && typeof obj['lockAt'] !== 'string')
        return false;
    if (obj['pointsPossible'] !== undefined && obj['pointsPossible'] !== null && typeof obj['pointsPossible'] !== 'number')
        return false;
    if (obj['submissionTypes'] !== undefined && !Array.isArray(obj['submissionTypes']))
        return false;
    if (obj['workflowState'] !== undefined && typeof obj['workflowState'] !== 'string')
        return false;
    if (obj['htmlUrl'] !== undefined && typeof obj['htmlUrl'] !== 'string')
        return false;
    if (obj['icalUid'] !== undefined && typeof obj['icalUid'] !== 'string')
        return false;
    if (obj['priority'] !== undefined && !['low', 'medium', 'high'].includes(obj['priority']))
        return false;
    if (obj['status'] !== undefined && !['pending', 'in_progress', 'completed'].includes(obj['status']))
        return false;
    if (obj['source'] !== undefined && !['manual', 'ical'].includes(obj['source']))
        return false;
    if (obj['sourceUrl'] !== undefined && typeof obj['sourceUrl'] !== 'string')
        return false;
    if (obj['rrule'] !== undefined && typeof obj['rrule'] !== 'string')
        return false;
    if (obj['createdAt'] !== undefined && typeof obj['createdAt'] !== 'string')
        return false;
    if (obj['updatedAt'] !== undefined && typeof obj['updatedAt'] !== 'string')
        return false;
    return true;
}
function isValidSubTaskInput(input) {
    if (!input || typeof input !== 'object')
        return false;
    const obj = input;
    return (typeof obj['assignmentId'] === 'string' &&
        typeof obj['title'] === 'string' &&
        typeof obj['completed'] === 'boolean' &&
        typeof obj['order'] === 'number');
}
function isValidNoteInput(input) {
    if (!input || typeof input !== 'object')
        return false;
    const obj = input;
    return typeof obj['assignmentId'] === 'string' && typeof obj['content'] === 'string';
}
function isValidPriorityOrderInput(input) {
    if (!input || typeof input !== 'object')
        return false;
    const obj = input;
    return typeof obj['assignmentId'] === 'string' && typeof obj['order'] === 'number';
}
function isValidSettings(input) {
    if (!input || typeof input !== 'object')
        return false;
    const obj = input;
    return ((obj['theme'] === undefined || ['light', 'dark', 'system'].includes(obj['theme'])) &&
        (obj['autoFetchIcal'] === undefined || typeof obj['autoFetchIcal'] === 'boolean') &&
        (obj['icalFetchIntervalMinutes'] === undefined ||
            typeof obj['icalFetchIntervalMinutes'] === 'number') &&
        (obj['defaultPriority'] === undefined || typeof obj['defaultPriority'] === 'number') &&
        (obj['showCompletedAssignments'] === undefined ||
            typeof obj['showCompletedAssignments'] === 'boolean') &&
        (obj['notifyDueSoon'] === undefined || typeof obj['notifyDueSoon'] === 'boolean') &&
        (obj['dueSoonThresholdHours'] === undefined || typeof obj['dueSoonThresholdHours'] === 'number'));
}
//# sourceMappingURL=types.js.map