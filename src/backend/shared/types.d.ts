/**
 * Core Domain Types
 *
 * Pure TypeScript — zero Electron/Node dependencies.
 * Used across Main, Preload, and Renderer via project references.
 *
 * @module @backend/shared/types
 */
/**
 * Unique identifier (UUID v4 string).
 */
export type EntityId = string & {
    readonly __brand: unique symbol;
};
/**
 * ISO 8601 date-time string.
 */
export type IsoDateTime = string & {
    readonly __brand: unique symbol;
};
/**
 * Assignment — core entity representing a course task.
 * Aligned with Phase 1 data model (20+ fields).
 */
export interface Assignment {
    id: EntityId;
    title: string;
    description: string;
    courseId: EntityId;
    courseName: string;
    courseColor: string;
    dueAt: IsoDateTime | null;
    unlockAt: IsoDateTime | null;
    lockAt: IsoDateTime | null;
    pointsPossible: number | null;
    submissionTypes: string[];
    workflowState: string;
    htmlUrl: string;
    icalUid: string;
    priority: 'low' | 'medium' | 'high';
    status: AssignmentStatus;
    source: AssignmentSource;
    sourceUrl?: string;
    rrule?: string;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
}
/**
 * Input for creating/updating an assignment.
 * All fields optional except id (for upsert).
 */
export interface AssignmentInput {
    id: EntityId;
    title?: string;
    description?: string;
    courseId?: EntityId;
    courseName?: string;
    courseColor?: string;
    dueAt?: IsoDateTime | null;
    unlockAt?: IsoDateTime | null;
    lockAt?: IsoDateTime | null;
    pointsPossible?: number | null;
    submissionTypes?: string[];
    workflowState?: string;
    htmlUrl?: string;
    icalUid?: string;
    priority?: 'low' | 'medium' | 'high';
    status?: AssignmentStatus;
    source?: AssignmentSource;
    sourceUrl?: string;
    rrule?: string;
    createdAt?: IsoDateTime;
    updatedAt?: IsoDateTime;
}
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'archived';
export type AssignmentSource = 'manual' | 'ical';
/**
 * SubTask — atomic unit of work within an assignment.
 */
export interface SubTask {
    id: EntityId;
    assignmentId: EntityId;
    title: string;
    completed: boolean;
    order: number;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
}
export interface SubTaskInput {
    assignmentId: EntityId;
    title: string;
    completed: boolean;
    order: number;
}
/**
 * Note — free-form text attached to an assignment.
 */
export interface Note {
    id: EntityId;
    assignmentId: EntityId;
    content: string;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
}
export interface NoteInput {
    assignmentId: EntityId;
    content: string;
}
/**
 * PriorityOrder — explicit ordering of assignments for drag-drop priority.
 * Separate from Assignment.priority to allow arbitrary reordering.
 */
export interface PriorityOrder {
    id: EntityId;
    assignmentId: EntityId;
    order: number;
    updatedAt: IsoDateTime;
}
export interface PriorityOrderInput {
    assignmentId: EntityId;
    order: number;
}
/**
 * User Settings — persisted in DB, synced via IPC.
 */
export interface Settings {
    theme: 'light' | 'dark' | 'system';
    autoFetchIcal: boolean;
    icalFetchIntervalMinutes: number;
    defaultPriority: 'low' | 'medium' | 'high';
    showCompletedAssignments: boolean;
    notifyDueSoon: boolean;
    dueSoonThresholdHours: number;
    icalUrl: string;
    lastSyncAt: IsoDateTime | null;
    autoFetchIntervalMs: number;
}
/**
 * Result of an iCal import operation with deduplication.
 */
export interface ImportResult {
    imported: number;
    skipped: number;
    updated: number;
}
/**
 * iCal Event — parsed from iCal feed, used for import preview.
 */
export interface ICalEvent {
    uid: string;
    summary: string;
    description: string | null;
    location: string | null;
    dtStart: IsoDateTime;
    dtEnd: IsoDateTime | null;
    rrule: string | null;
    url: string | null;
    categories: string[];
}
/**
 * Course — optional grouping for assignments (future use).
 */
export interface Course {
    id: EntityId;
    name: string;
    code: string;
    color: string;
    term: string;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
}
export interface CourseInput {
    name: string;
    code: string;
    color: string;
    term: string;
}
/**
 * Database row types (snake_case for SQL compatibility).
 * Internal to Main process — not exposed via IPC.
 */
export interface DbAssignment {
    id: string;
    canvas_id: string | null;
    title: string;
    description: string | null;
    course_name: string;
    course_color: string | null;
    due_at: number;
    unlock_at: number | null;
    lock_at: number | null;
    points_possible: number | null;
    submission_types: string | null;
    workflow_state: string | null;
    html_url: string | null;
    ical_uid: string | null;
    status: string | null;
    source: string | null;
    source_url: string | null;
    rrule: string | null;
    created_at: number;
    updated_at: number;
}
export interface DbSubTask {
    id: string;
    assignment_id: string;
    title: string;
    completed: number;
    position: number;
    created_at: number;
    updated_at: number;
}
export interface DbNote {
    assignment_id: string;
    content: string;
    updated_at: number;
}
export interface DbPriorityOrder {
    assignment_id: string;
    position: number;
}
export interface DbSettings {
    key: string;
    value: string;
}
export interface DbCourse {
    id: string;
    name: string;
    code: string;
    color: string;
    term: string;
    created_at: string;
    updated_at: string;
}
/**
 * Type guards for runtime validation (used in Main handlers).
 */
export declare function isValidAssignment(input: unknown): input is AssignmentInput;
export declare function isValidSubTaskInput(input: unknown): input is SubTaskInput;
export declare function isValidNoteInput(input: unknown): input is NoteInput;
export declare function isValidPriorityOrderInput(input: unknown): input is PriorityOrderInput;
export declare function isValidSettings(input: unknown): input is Partial<Settings>;
//# sourceMappingURL=types.d.ts.map