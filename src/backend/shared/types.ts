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
export type EntityId = string & { readonly __brand: unique symbol };

/**
 * ISO 8601 date-time string.
 */
export type IsoDateTime = string & { readonly __brand: unique symbol };

/**
 * Assignment — core entity representing a course task.
 * Aligned with Phase 1 data model (20+ fields).
 */
export interface Assignment {
  id: EntityId; // Canvas assignment ID or generated
  title: string;
  description: string; // HTML from Canvas
  courseId: EntityId; // Canvas course ID
  courseName: string; // Canvas course name
  courseColor: string; // Hex color from Canvas (e.g., "#e8a838")
  dueAt: IsoDateTime | null; // ISO 8601 (Canvas: due_at)
  unlockAt: IsoDateTime | null; // ISO 8601
  lockAt: IsoDateTime | null; // ISO 8601
  pointsPossible: number | null;
  submissionTypes: string[]; // e.g., ["online_text_entry", "online_upload"]
  workflowState: string; // "published", "unpublished", etc.
  htmlUrl: string; // Canvas assignment URL
  icalUid: string; // UID from iCal VEVENT
  priority: 'low' | 'medium' | 'high'; // Calculated: overdue→high, dueSoon→medium, else→low
  status: AssignmentStatus;
  source: AssignmentSource;
  sourceUrl?: string; // iCal feed URL this came from
  rrule?: string; // RRULE string for recurring
  createdAt: IsoDateTime; // ISO 8601
  updatedAt: IsoDateTime; // ISO 8601
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

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed';

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
  content: string; // Markdown
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
  id: EntityId; // same as assignmentId
  assignmentId: EntityId;
  order: number; // 0 = highest priority
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
  // NEW fields needed by Phase 1:
  icalUrl: string; // User's Canvas iCal feed URL
  lastSyncAt: IsoDateTime | null; // ISO 8601, updated on successful import
  autoFetchIntervalMs: number; // Computed: icalFetchIntervalMinutes * 60 * 1000
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
  rrule: string | null; // RFC 5545 recurrence rule
  url: string | null;
  categories: string[]; // e.g., ['CS101', 'Homework']
}

/**
 * Course — optional grouping for assignments (future use).
 */
export interface Course {
  id: EntityId;
  name: string;
  code: string; // e.g., "CS101"
  color: string; // hex color
  term: string; // e.g., "Fall 2025"
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
  completed: number; // 0/1
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
  value: string; // JSON stringified
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
export function isValidAssignment(input: unknown): input is AssignmentInput {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  // Only id is required for upsert
  if (typeof obj['id'] !== 'string') return false;
  // All other fields are optional, but if present must be correct type
  if (obj['title'] !== undefined && typeof obj['title'] !== 'string') return false;
  if (obj['description'] !== undefined && typeof obj['description'] !== 'string') return false;
  if (obj['courseId'] !== undefined && typeof obj['courseId'] !== 'string') return false;
  if (obj['courseName'] !== undefined && typeof obj['courseName'] !== 'string') return false;
  if (obj['courseColor'] !== undefined && typeof obj['courseColor'] !== 'string') return false;
  if (obj['dueAt'] !== undefined && obj['dueAt'] !== null && typeof obj['dueAt'] !== 'string') return false;
  if (obj['unlockAt'] !== undefined && obj['unlockAt'] !== null && typeof obj['unlockAt'] !== 'string') return false;
  if (obj['lockAt'] !== undefined && obj['lockAt'] !== null && typeof obj['lockAt'] !== 'string') return false;
  if (obj['pointsPossible'] !== undefined && obj['pointsPossible'] !== null && typeof obj['pointsPossible'] !== 'number') return false;
  if (obj['submissionTypes'] !== undefined && !Array.isArray(obj['submissionTypes'])) return false;
  if (obj['workflowState'] !== undefined && typeof obj['workflowState'] !== 'string') return false;
  if (obj['htmlUrl'] !== undefined && typeof obj['htmlUrl'] !== 'string') return false;
  if (obj['icalUid'] !== undefined && typeof obj['icalUid'] !== 'string') return false;
  if (obj['priority'] !== undefined && !['low', 'medium', 'high'].includes(obj['priority'] as string)) return false;
  if (obj['status'] !== undefined && !['pending', 'in_progress', 'completed'].includes(obj['status'] as string)) return false;
  if (obj['source'] !== undefined && !['manual', 'ical'].includes(obj['source'] as string)) return false;
  if (obj['sourceUrl'] !== undefined && typeof obj['sourceUrl'] !== 'string') return false;
  if (obj['rrule'] !== undefined && typeof obj['rrule'] !== 'string') return false;
  if (obj['createdAt'] !== undefined && typeof obj['createdAt'] !== 'string') return false;
  if (obj['updatedAt'] !== undefined && typeof obj['updatedAt'] !== 'string') return false;
  return true;
}

export function isValidSubTaskInput(input: unknown): input is SubTaskInput {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return (
    typeof obj['assignmentId'] === 'string' &&
    typeof obj['title'] === 'string' &&
    typeof obj['completed'] === 'boolean' &&
    typeof obj['order'] === 'number'
  );
}

export function isValidNoteInput(input: unknown): input is NoteInput {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return typeof obj['assignmentId'] === 'string' && typeof obj['content'] === 'string';
}

export function isValidPriorityOrderInput(input: unknown): input is PriorityOrderInput {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return typeof obj['assignmentId'] === 'string' && typeof obj['order'] === 'number';
}

export function isValidSettings(input: unknown): input is Partial<Settings> {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return (
    (obj['theme'] === undefined || ['light', 'dark', 'system'].includes(obj['theme'] as string)) &&
    (obj['autoFetchIcal'] === undefined || typeof obj['autoFetchIcal'] === 'boolean') &&
    (obj['icalFetchIntervalMinutes'] === undefined ||
      typeof obj['icalFetchIntervalMinutes'] === 'number') &&
    (obj['defaultPriority'] === undefined || typeof obj['defaultPriority'] === 'number') &&
    (obj['showCompletedAssignments'] === undefined ||
      typeof obj['showCompletedAssignments'] === 'boolean') &&
    (obj['notifyDueSoon'] === undefined || typeof obj['notifyDueSoon'] === 'boolean') &&
    (obj['dueSoonThresholdHours'] === undefined || typeof obj['dueSoonThresholdHours'] === 'number')
  );
}
