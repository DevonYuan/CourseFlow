/**
 * Database Repository — Main Process
 *
 * Typed, asynchronous CRUD operations using sql.js (WASM).
 * All functions throw on SQL error (handled by IPC layer).
 * Zero `any` usage — all inputs/outputs fully typed.
 *
 * @module @backend/main/db/repository
 */
import type { Assignment, AssignmentInput, AssignmentStatus, SubTask, SubTaskInput, Note, PriorityOrder, PriorityOrderInput, Settings, ImportResult } from '../../shared/types.js';
export declare const repo: {
    /**
     * List all assignments ordered by due date.
     */
    listAssignments(): Assignment[];
    /**
     * Get a single assignment by ID.
     */
    getAssignment(id: string): Assignment | null;
    /**
     * Find assignment by iCal UID (for sync deduplication).
     */
    findByICalUID(uid: string): Assignment | null;
    /**
     * List assignments for a specific course.
     */
    listAssignmentsByCourse(courseName: string): Assignment[];
    /**
     * Insert or update an assignment.
     * Returns the created/updated assignment with generated timestamps.
     */
    upsertAssignment(input: AssignmentInput): Assignment;
    /**
     * Delete an assignment (cascades to sub_tasks, notes, priority_order).
     */
    deleteAssignment(id: string): void;
    /**
     * Update an assignment's status.
     * Emits db:changed event.
     */
    updateAssignmentStatus(id: string, status: AssignmentStatus): Assignment | null;
    /**
     * Bulk upsert assignments (for iCal sync).
     * Returns array of created/updated assignments.
     */
    bulkUpsertAssignments(inputs: AssignmentInput[]): Assignment[];
    /**
     * Import assignments with deduplication by ical_uid.
     * Matches existing assignments by ical_uid and applies conflict resolution:
     * - New ical_uid → INSERT (counted as imported)
     * - Existing ical_uid with newer updatedAt → UPDATE (counted as updated)
     * - Existing ical_uid with older/equal updatedAt → SKIP (counted as skipped)
     *
     * On UPDATE, preserves user-edited fields: description, status (if completed or archived), priority.
     * Emits db:changed events for each insert/update.
     * Transactional — all or nothing.
     */
    importAssignments(inputs: AssignmentInput[]): ImportResult;
    /**
     * Get all assignment IDs in priority order (0 = highest priority).
     */
    getPriorityOrder(): string[];
    /**
     * Set the complete priority order from an array of assignment IDs.
     * Replaces all existing priority order entries.
     */
    setPriorityOrder(ids: string[]): void;
    /**
     * Upsert a single priority order entry.
     */
    upsertPriorityOrder(input: PriorityOrderInput): PriorityOrder;
    /**
     * List all sub-tasks for an assignment, ordered by position.
     */
    listSubTasks(assignmentId: string): SubTask[];
    /**
     * Insert or update a sub-task.
     */
    upsertSubTask(input: SubTaskInput): SubTask;
    /**
     * Delete a sub-task by ID.
     */
    deleteSubTask(id: string): void;
    /**
     * Reorder sub-tasks for an assignment.
     * Updates positions based on the provided ordered array of IDs.
     */
    reorderSubTasks(assignmentId: string, ids: string[]): void;
    /**
     * Get the note for an assignment.
     */
    getNote(assignmentId: string): Note | null;
    /**
     * Set (create or update) the note for an assignment.
     */
    setNote(assignmentId: string, content: string): Note;
    /**
     * Get a setting value with a default fallback.
     * Automatically decrypts 'icalUrl' if encrypted.
     */
    getSetting<T>(key: string, defaultValue: T): Promise<T>;
    /**
     * Set a setting value (JSON stringified).
     * Automatically encrypts 'icalUrl' before storing.
     */
    setSetting<T>(key: string, value: T): Promise<void>;
    /**
     * Get all settings as a Settings object.
     * Automatically decrypts 'icalUrl' if encrypted.
     */
    getAllSettings(): Promise<Settings>;
    /**
     * Set multiple settings at once (merge with existing).
     * Automatically encrypts 'icalUrl' before storing.
     * Uses a single transaction for atomicity.
     */
    setSettings(partial: Partial<Settings>): Promise<Settings>;
    /**
     * Reset all settings to defaults.
     * Clears the settings table and re-inserts default values.
     */
    resetSettings(): Promise<Settings>;
};
//# sourceMappingURL=repository.d.ts.map