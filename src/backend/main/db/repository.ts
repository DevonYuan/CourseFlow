/**
 * Database Repository — Main Process
 *
 * Typed, synchronous CRUD operations using prepared statements.
 * All functions throw on SQL error (handled by IPC layer).
 * Zero `any` usage — all inputs/outputs fully typed.
 *
 * @module @backend/main/db/repository
 */

import { randomUUID } from 'node:crypto';

import type {
  Assignment,
  AssignmentInput,
  SubTask,
  SubTaskInput,
  Note,
  PriorityOrder,
  PriorityOrderInput,
  Settings,
  DbAssignment,
  DbSubTask,
  DbSettings,
} from '../shared/types.js';

import { getDatabase } from './connection.js';

// ============================================================================
// Prepared Statements (cached in module scope)
// ============================================================================

const db = getDatabase();

// --- Assignments ---
const stmtListAssignments = db.prepare('SELECT * FROM assignments ORDER BY due_at ASC');
const stmtGetAssignment = db.prepare('SELECT * FROM assignments WHERE id = ?');
const stmtFindByICalUID = db.prepare('SELECT * FROM assignments WHERE ical_uid = ?');
const stmtListAssignmentsByCourse = db.prepare(
  'SELECT * FROM assignments WHERE course_name = ? ORDER BY due_at ASC',
);
const stmtUpsertAssignment = db.prepare(`
  INSERT INTO assignments (
    id, canvas_id, title, description, course_name, course_color,
    due_at, unlock_at, lock_at, points_possible, submission_types,
    workflow_state, html_url, ical_uid, created_at, updated_at
  ) VALUES (
    @id, @canvas_id, @title, @description, @course_name, @course_color,
    @due_at, @unlock_at, @lock_at, @points_possible, @submission_types,
    @workflow_state, @html_url, @ical_uid, @created_at, @updated_at
  )
  ON CONFLICT(id) DO UPDATE SET
    canvas_id = excluded.canvas_id,
    title = excluded.title,
    description = excluded.description,
    course_name = excluded.course_name,
    course_color = excluded.course_color,
    due_at = excluded.due_at,
    unlock_at = excluded.unlock_at,
    lock_at = excluded.lock_at,
    points_possible = excluded.points_possible,
    submission_types = excluded.submission_types,
    workflow_state = excluded.workflow_state,
    html_url = excluded.html_url,
    ical_uid = excluded.ical_uid,
    updated_at = excluded.updated_at
  RETURNING *;
`);
const stmtDeleteAssignment = db.prepare('DELETE FROM assignments WHERE id = ?');

// --- Priority Order ---
const stmtGetPriorityOrder = db.prepare(
  'SELECT assignment_id FROM priority_order ORDER BY position ASC',
);
const stmtSetPriorityOrder = db.prepare(
  'INSERT OR REPLACE INTO priority_order (assignment_id, position) VALUES (?, ?)',
);
const stmtUpsertPriorityOrder = db.prepare(`
  INSERT INTO priority_order (assignment_id, position)
  VALUES (?, ?)
  ON CONFLICT(assignment_id) DO UPDATE SET position = excluded.position
`);

// --- Sub-tasks ---
const stmtListSubTasks = db.prepare(
  'SELECT * FROM sub_tasks WHERE assignment_id = ? ORDER BY position ASC',
);
const stmtUpsertSubTask = db.prepare(`
  INSERT INTO sub_tasks (id, assignment_id, title, completed, position, created_at, updated_at)
  VALUES (@id, @assignment_id, @title, @completed, @position, @created_at, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    assignment_id = excluded.assignment_id,
    title = excluded.title,
    completed = excluded.completed,
    position = excluded.position,
    updated_at = excluded.updated_at
  RETURNING *;
`);
const stmtDeleteSubTask = db.prepare('DELETE FROM sub_tasks WHERE id = ?');
const stmtReorderSubTasks = db.prepare(
  'UPDATE sub_tasks SET position = ?, updated_at = ? WHERE id = ?',
);

// --- Notes ---
const stmtGetNote = db.prepare('SELECT * FROM notes WHERE assignment_id = ?');
const stmtUpsertNote = db.prepare(`
  INSERT INTO notes (assignment_id, content, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(assignment_id) DO UPDATE SET
    content = excluded.content,
    updated_at = excluded.updated_at
  RETURNING *;
`);

// --- Settings ---
const stmtGetSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const stmtSetSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

// --- Bulk Operations ---
const stmtBulkUpsertAssignments = db.prepare(`
  INSERT INTO assignments (
    id, canvas_id, title, description, course_name, course_color,
    due_at, unlock_at, lock_at, points_possible, submission_types,
    workflow_state, html_url, ical_uid, created_at, updated_at
  ) VALUES (
    @id, @canvas_id, @title, @description, @course_name, @course_color,
    @due_at, @unlock_at, @lock_at, @points_possible, @submission_types,
    @workflow_state, @html_url, @ical_uid, @created_at, @updated_at
  )
  ON CONFLICT(id) DO UPDATE SET
    canvas_id = excluded.canvas_id,
    title = excluded.title,
    description = excluded.description,
    course_name = excluded.course_name,
    course_color = excluded.course_color,
    due_at = excluded.due_at,
    unlock_at = excluded.unlock_at,
    lock_at = excluded.lock_at,
    points_possible = excluded.points_possible,
    submission_types = excluded.submission_types,
    workflow_state = excluded.workflow_state,
    html_url = excluded.html_url,
    ical_uid = excluded.ical_uid,
    updated_at = excluded.updated_at
  RETURNING *;
`);

// ============================================================================
// Type Conversion Helpers
// ============================================================================

function toIsoDateTime(ms: number): string {
  return new Date(ms).toISOString();
}

function toUnixMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return new Date(iso).getTime();
}

function mapDbAssignmentToAssignment(row: DbAssignment): Assignment {
  return {
    id: row.id as Assignment['id'],
    title: row.title,
    description: row.description ?? '',
    courseId: row.course_name as Assignment['courseId'],
    dueDate: toIsoDateTime(row.due_at),
    // Derive priority from due date (sooner = higher priority)
    priority: row.due_at,
    // Map workflow_state to status
    status: (row.workflow_state as Assignment['status']) ?? 'pending',
    // Determine source from ical_uid
    source: row.ical_uid ? 'ical' : 'manual',
    sourceUrl: row.html_url ?? row.ical_uid,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  };
}

function mapDbSubTaskToSubTask(row: DbSubTask): SubTask {
  return {
    id: row.id as SubTask['id'],
    assignmentId: row.assignment_id as SubTask['assignmentId'],
    title: row.title,
    completed: row.completed === 1,
    order: row.position,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  };
}

function mapSubTaskInputToDb(input: SubTaskInput, now: number): DbSubTask {
  return {
    id: randomUUID(),
    assignment_id: input.assignmentId,
    title: input.title,
    completed: input.completed ? 1 : 0,
    position: input.order,
    created_at: now,
    updated_at: now,
  };
}

function mapDbSettingsToSettings(rows: DbSettings[]): Settings {
  const defaults: Settings = {
    theme: 'system',
    autoFetchIcal: false,
    icalFetchIntervalMinutes: 60,
    defaultPriority: 100,
    showCompletedAssignments: true,
    notifyDueSoon: true,
    dueSoonThresholdHours: 24,
  };

  const result = { ...defaults };
  for (const row of rows) {
    try {
      const value = JSON.parse(row.value);
      // Type-safe assignment - we trust the stored JSON matches Settings structure
      (result as Record<string, unknown>)[row.key] = value;
    } catch {
      // Ignore invalid JSON, keep default
    }
  }
  return result;
}

// ============================================================================
// Repository API
// ============================================================================

export const repo = {
  // --- Assignments ---

  /**
   * List all assignments ordered by due date.
   */
  listAssignments(): Assignment[] {
    const rows = stmtListAssignments.all() as DbAssignment[];
    return rows.map(mapDbAssignmentToAssignment);
  },

  /**
   * Get a single assignment by ID.
   */
  getAssignment(id: string): Assignment | null {
    const row = stmtGetAssignment.get(id);
    return row ? mapDbAssignmentToAssignment(row as DbAssignment) : null;
  },

  /**
   * Find assignment by iCal UID (for sync deduplication).
   */
  findByICalUID(uid: string): Assignment | null {
    const row = stmtFindByICalUID.get(uid);
    return row ? mapDbAssignmentToAssignment(row as DbAssignment) : null;
  },

  /**
   * List assignments for a specific course.
   */
  listAssignmentsByCourse(courseName: string): Assignment[] {
    const rows = stmtListAssignmentsByCourse.all(courseName) as DbAssignment[];
    return rows.map(mapDbAssignmentToAssignment);
  },

  /**
   * Insert or update an assignment.
   * Returns the created/updated assignment with generated timestamps.
   */
  upsertAssignment(input: AssignmentInput): Assignment {
    const now = Date.now();
    const id = randomUUID();

    const row = stmtUpsertAssignment.get({
      id,
      canvas_id: null,
      title: input.title,
      description: input.description,
      course_name: input.courseId ?? '',
      course_color: null,
      due_at: toUnixMs(input.dueDate) ?? now,
      unlock_at: null,
      lock_at: null,
      points_possible: null,
      submission_types: null,
      workflow_state: input.status,
      html_url: input.sourceUrl,
      ical_uid: input.source === 'ical' ? input.sourceUrl : null,
      created_at: now,
      updated_at: now,
    });

    return mapDbAssignmentToAssignment(row);
  },

  /**
   * Delete an assignment (cascades to sub_tasks, notes, priority_order).
   */
  deleteAssignment(id: string): void {
    stmtDeleteAssignment.run(id);
  },

  /**
   * Bulk upsert assignments (for iCal sync).
   * Returns array of created/updated assignments.
   */
  bulkUpsertAssignments(inputs: AssignmentInput[]): Assignment[] {
    const now = Date.now();
    const results: Assignment[] = [];

    const transaction = db.transaction((items: AssignmentInput[]) => {
      for (const input of items) {
        const id = randomUUID();
        const row = stmtBulkUpsertAssignments.get({
          id,
          canvas_id: null,
          title: input.title,
          description: input.description,
          course_name: input.courseId ?? '',
          course_color: null,
          due_at: toUnixMs(input.dueDate) ?? now,
          unlock_at: null,
          lock_at: null,
          points_possible: null,
          submission_types: null,
          workflow_state: input.status,
          html_url: input.sourceUrl,
          ical_uid: input.source === 'ical' ? input.sourceUrl : null,
          created_at: now,
          updated_at: now,
        });
        results.push(mapDbAssignmentToAssignment(row));
      }
    });

    transaction(inputs);
    return results;
  },

  // --- Priority Order ---

  /**
   * Get all assignment IDs in priority order (0 = highest priority).
   */
  getPriorityOrder(): string[] {
    const rows = stmtGetPriorityOrder.all() as { assignment_id: string }[];
    return rows.map((r) => r.assignment_id);
  },

  /**
   * Set the complete priority order from an array of assignment IDs.
   * Replaces all existing priority order entries.
   */
  setPriorityOrder(ids: string[]): void {
    const transaction = db.transaction((items: string[]) => {
      // Clear existing
      db.prepare('DELETE FROM priority_order').run();
      // Insert new order
      for (let i = 0; i < items.length; i++) {
        stmtSetPriorityOrder.run(items[i], i);
      }
    });
    transaction(ids);
  },

  /**
   * Upsert a single priority order entry.
   */
  upsertPriorityOrder(input: PriorityOrderInput): PriorityOrder {
    const now = Date.now();
    stmtUpsertPriorityOrder.run(input.assignmentId, input.order);
    return {
      id: input.assignmentId as PriorityOrder['id'],
      assignmentId: input.assignmentId,
      order: input.order,
      updatedAt: toIsoDateTime(now),
    };
  },

  // --- Sub-tasks ---

  /**
   * List all sub-tasks for an assignment, ordered by position.
   */
  listSubTasks(assignmentId: string): SubTask[] {
    const rows = stmtListSubTasks.all(assignmentId) as DbSubTask[];
    return rows.map(mapDbSubTaskToSubTask);
  },

  /**
   * Insert or update a sub-task.
   */
  upsertSubTask(input: SubTaskInput): SubTask {
    const now = Date.now();
    const dbInput = mapSubTaskInputToDb(input, now);

    const row = stmtUpsertSubTask.get({
      id: dbInput.id,
      assignment_id: dbInput.assignment_id,
      title: dbInput.title,
      completed: dbInput.completed,
      position: dbInput.position,
      created_at: now,
      updated_at: now,
    });

    return mapDbSubTaskToSubTask(row);
  },

  /**
   * Delete a sub-task by ID.
   */
  deleteSubTask(id: string): void {
    stmtDeleteSubTask.run(id);
  },

  /**
   * Reorder sub-tasks for an assignment.
   * Updates positions based on the provided ordered array of IDs.
   */
  reorderSubTasks(assignmentId: string, ids: string[]): void {
    const transaction = db.transaction((items: string[]) => {
      const now = Date.now();
      for (let i = 0; i < items.length; i++) {
        stmtReorderSubTasks.run(i, now, items[i]);
      }
    });
    transaction(ids);
  },

  // --- Notes ---

  /**
   * Get the note for an assignment.
   */
  getNote(assignmentId: string): Note | null {
    const row = stmtGetNote.get(assignmentId);
    if (!row) return null;
    return {
      id: row.assignment_id as Note['id'],
      assignmentId: row.assignment_id as Note['assignmentId'],
      content: row.content,
      createdAt: toIsoDateTime(row.updated_at),
      updatedAt: toIsoDateTime(row.updated_at),
    };
  },

  /**
   * Set (create or update) the note for an assignment.
   */
  setNote(assignmentId: string, content: string): Note {
    const now = Date.now();
    const row = stmtUpsertNote.get(assignmentId, content, now);
    return {
      id: row.assignment_id as Note['id'],
      assignmentId: row.assignment_id as Note['assignmentId'],
      content: row.content,
      createdAt: toIsoDateTime(row.updated_at),
      updatedAt: toIsoDateTime(row.updated_at),
    };
  },

  // --- Settings ---

  /**
   * Get a setting value with a default fallback.
   */
  getSetting<T>(key: string, defaultValue: T): T {
    const row = stmtGetSetting.get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse((row as DbSettings).value) as T;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Set a setting value (JSON stringified).
   */
  setSetting<T>(key: string, value: T): void {
    stmtSetSetting.run(key, JSON.stringify(value));
  },

  /**
   * Get all settings as a Settings object.
   */
  getAllSettings(): Settings {
    const rows = db.prepare('SELECT * FROM settings').all() as DbSettings[];
    return mapDbSettingsToSettings(rows);
  },
};
