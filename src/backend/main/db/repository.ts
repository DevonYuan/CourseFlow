/**
 * Database Repository — Main Process
 *
 * Typed, asynchronous CRUD operations using sql.js (WASM).
 * All functions throw on SQL error (handled by IPC layer).
 * Zero `any` usage — all inputs/outputs fully typed.
 *
 * @module @backend/main/db/repository
 */

import { randomUUID } from 'node:crypto';

import type {
  Assignment,
  AssignmentInput,
  AssignmentStatus,
  SubTask,
  SubTaskInput,
  Note,
  PriorityOrder,
  PriorityOrderInput,
  Settings,
  DbAssignment,
  DbSubTask,
  DbSettings,
  IsoDateTime,
} from '../../shared/types.js';

import { getDatabase, saveDatabase } from './connection.js';
import { sendEventToRenderers } from '../events.js';

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

/**
 * Map database row to Assignment domain object.
 * Exported for testing.
 */
export function mapDbAssignmentToAssignment(row: DbAssignment): Assignment {
  return {
    id: row.id as Assignment['id'],
    title: row.title,
    description: row.description ?? '',
    courseId: row.course_name as Assignment['courseId'],
    courseName: row.course_name,
    courseColor: row.course_color ?? '#6366f1',
    dueAt: row.due_at ? (toIsoDateTime(row.due_at) as IsoDateTime) : null,
    unlockAt: row.unlock_at ? (toIsoDateTime(row.unlock_at) as IsoDateTime) : null,
    lockAt: row.lock_at ? (toIsoDateTime(row.lock_at) as IsoDateTime) : null,
    pointsPossible: row.points_possible ?? null,
    submissionTypes: row.submission_types ? JSON.parse(row.submission_types) : [],
    workflowState: row.workflow_state ?? 'published',
    htmlUrl: row.html_url ?? '',
    icalUid: row.ical_uid ?? '',
    // priority is calculated, not stored in DB
    priority: 'low' as Assignment['priority'],
    status: (row.status as Assignment['status']) ?? 'pending',
    source: (row.source as Assignment['source']) ?? 'manual',
    sourceUrl: row.source_url ?? undefined,
    rrule: row.rrule ?? undefined,
    createdAt: toIsoDateTime(row.created_at) as Assignment['createdAt'],
    updatedAt: toIsoDateTime(row.updated_at) as Assignment['updatedAt'],
  };
}

/**
 * Map AssignmentInput to database row format for upsert.
 * Only includes fields that are defined in the input.
 * Exported for testing.
 */
export function mapAssignmentInputToDb(input: AssignmentInput, now: number): Partial<DbAssignment> {
  const dbRow: Partial<DbAssignment> = {};

  if (input.id !== undefined) dbRow.id = input.id;
  if (input.title !== undefined) dbRow.title = input.title;
  if (input.description !== undefined) dbRow.description = input.description;
  if (input.courseId !== undefined) dbRow.canvas_id = input.courseId;
  if (input.courseName !== undefined) dbRow.course_name = input.courseName;
  if (input.courseColor !== undefined) dbRow.course_color = input.courseColor;
  if (input.dueAt !== undefined) dbRow.due_at = toUnixMs(input.dueAt) ?? now;
  if (input.unlockAt !== undefined) dbRow.unlock_at = toUnixMs(input.unlockAt);
  if (input.lockAt !== undefined) dbRow.lock_at = toUnixMs(input.lockAt);
  if (input.pointsPossible !== undefined) dbRow.points_possible = input.pointsPossible;
  if (input.submissionTypes !== undefined) dbRow.submission_types = JSON.stringify(input.submissionTypes);
  if (input.workflowState !== undefined) dbRow.workflow_state = input.workflowState;
  if (input.htmlUrl !== undefined) dbRow.html_url = input.htmlUrl;
  if (input.icalUid !== undefined) dbRow.ical_uid = input.icalUid;
  // priority is calculated, not stored in DB — skip
  if (input.status !== undefined) dbRow.status = input.status;
  if (input.source !== undefined) dbRow.source = input.source;
  if (input.sourceUrl !== undefined) dbRow.source_url = input.sourceUrl;
  if (input.rrule !== undefined) dbRow.rrule = input.rrule;
  if (input.createdAt !== undefined) dbRow.created_at = toUnixMs(input.createdAt) ?? now;
  if (input.updatedAt !== undefined) dbRow.updated_at = toUnixMs(input.updatedAt) ?? now;

  return dbRow;
}

function mapDbSubTaskToSubTask(row: DbSubTask): SubTask {
  return {
    id: row.id as SubTask['id'],
    assignmentId: row.assignment_id as SubTask['assignmentId'],
    title: row.title,
    completed: row.completed === 1,
    order: row.position,
    createdAt: toIsoDateTime(row.created_at) as SubTask['createdAt'],
    updatedAt: toIsoDateTime(row.updated_at) as SubTask['updatedAt'],
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
    defaultPriority: 'medium',
    showCompletedAssignments: true,
    notifyDueSoon: true,
    dueSoonThresholdHours: 24,
    icalUrl: '',
    lastSyncAt: null,
    autoFetchIntervalMs: 60 * 60 * 1000, // 60 minutes in ms
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
  // Compute autoFetchIntervalMs from icalFetchIntervalMinutes
  result.autoFetchIntervalMs = result.icalFetchIntervalMinutes * 60 * 1000;
  return result;
}

// ============================================================================
// SQL Helpers
// ============================================================================

function run(sql: string, params: (string | number | null)[] = []): void {
  const db = getDatabase();
  db.run(sql, params);
  saveDatabase();
}

function get<T>(sql: string, params: (string | number | null)[] = []): T | null {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = stmt.getAsObject();
  stmt.free();
  return result as T | null;
}

function all<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

function exec(sql: string): void {
  const db = getDatabase();
  db.exec(sql);
  saveDatabase();
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
    const rows = all<DbAssignment>('SELECT * FROM assignments ORDER BY due_at ASC');
    return rows.map(mapDbAssignmentToAssignment);
  },

  /**
   * Get a single assignment by ID.
   */
  getAssignment(id: string): Assignment | null {
    const row = get<DbAssignment>('SELECT * FROM assignments WHERE id = ?', [id]);
    return row ? mapDbAssignmentToAssignment(row) : null;
  },

  /**
   * Find assignment by iCal UID (for sync deduplication).
   */
  findByICalUID(uid: string): Assignment | null {
    const row = get<DbAssignment>('SELECT * FROM assignments WHERE ical_uid = ?', [uid]);
    return row ? mapDbAssignmentToAssignment(row) : null;
  },

  /**
   * List assignments for a specific course.
   */
  listAssignmentsByCourse(courseName: string): Assignment[] {
    const rows = all<DbAssignment>(
      'SELECT * FROM assignments WHERE course_name = ? ORDER BY due_at ASC',
      [courseName],
    );
    return rows.map(mapDbAssignmentToAssignment);
  },

  /**
   * Insert or update an assignment.
   * Returns the created/updated assignment with generated timestamps.
   */
  upsertAssignment(input: AssignmentInput): Assignment {
    const now = Date.now();
    // Use provided ID or generate new one
    const id = input.id ?? randomUUID();

    const dbRow = mapAssignmentInputToDb(input, now);

    // Build dynamic INSERT/UPDATE based on provided fields
    const columns: string[] = ['id'];
    const values: (string | number | null)[] = [id];
    const updates: string[] = [];

    if (dbRow.canvas_id !== undefined) { columns.push('canvas_id'); values.push(dbRow.canvas_id); updates.push('canvas_id = excluded.canvas_id'); }
    if (dbRow.title !== undefined) { columns.push('title'); values.push(dbRow.title); updates.push('title = excluded.title'); }
    if (dbRow.description !== undefined) { columns.push('description'); values.push(dbRow.description); updates.push('description = excluded.description'); }
    if (dbRow.course_name !== undefined) { columns.push('course_name'); values.push(dbRow.course_name); updates.push('course_name = excluded.course_name'); }
    if (dbRow.course_color !== undefined) { columns.push('course_color'); values.push(dbRow.course_color); updates.push('course_color = excluded.course_color'); }
    if (dbRow.due_at !== undefined) { columns.push('due_at'); values.push(dbRow.due_at); updates.push('due_at = excluded.due_at'); }
    if (dbRow.unlock_at !== undefined) { columns.push('unlock_at'); values.push(dbRow.unlock_at); updates.push('unlock_at = excluded.unlock_at'); }
    if (dbRow.lock_at !== undefined) { columns.push('lock_at'); values.push(dbRow.lock_at); updates.push('lock_at = excluded.lock_at'); }
    if (dbRow.points_possible !== undefined) { columns.push('points_possible'); values.push(dbRow.points_possible); updates.push('points_possible = excluded.points_possible'); }
    if (dbRow.submission_types !== undefined) { columns.push('submission_types'); values.push(dbRow.submission_types); updates.push('submission_types = excluded.submission_types'); }
    if (dbRow.workflow_state !== undefined) { columns.push('workflow_state'); values.push(dbRow.workflow_state); updates.push('workflow_state = excluded.workflow_state'); }
    if (dbRow.html_url !== undefined) { columns.push('html_url'); values.push(dbRow.html_url); updates.push('html_url = excluded.html_url'); }
    if (dbRow.ical_uid !== undefined) { columns.push('ical_uid'); values.push(dbRow.ical_uid); updates.push('ical_uid = excluded.ical_uid'); }
    if (dbRow.status !== undefined) { columns.push('status'); values.push(dbRow.status); updates.push('status = excluded.status'); }
    if (dbRow.source !== undefined) { columns.push('source'); values.push(dbRow.source); updates.push('source = excluded.source'); }
    if (dbRow.source_url !== undefined) { columns.push('source_url'); values.push(dbRow.source_url); updates.push('source_url = excluded.source_url'); }
    if (dbRow.rrule !== undefined) { columns.push('rrule'); values.push(dbRow.rrule); updates.push('rrule = excluded.rrule'); }
    if (dbRow.created_at !== undefined) { columns.push('created_at'); values.push(dbRow.created_at); }
    if (dbRow.updated_at !== undefined) { columns.push('updated_at'); values.push(dbRow.updated_at); updates.push('updated_at = excluded.updated_at'); }

    // Always update updated_at on conflict
    if (!updates.some(u => u.startsWith('updated_at'))) {
      updates.push('updated_at = excluded.updated_at');
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `
      INSERT INTO assignments (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}
    `;

    run(sql, values);

    const row = get<DbAssignment>('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to retrieve upserted assignment');
    return mapDbAssignmentToAssignment(row);
  },

  /**
   * Delete an assignment (cascades to sub_tasks, notes, priority_order).
   */
  deleteAssignment(id: string): void {
    run('DELETE FROM assignments WHERE id = ?', [id]);
  },

  /**
   * Update an assignment's status.
   * Emits db:changed event.
   */
  updateAssignmentStatus(id: string, status: AssignmentStatus): Assignment | null {
    const now = Date.now();
    run('UPDATE assignments SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);

    const row = get<DbAssignment>('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!row) return null;

    const assignment = mapDbAssignmentToAssignment(row);
    sendEventToRenderers('db:changed', { table: 'assignments', action: 'update', id });
    return assignment;
  },

  /**
   * Bulk upsert assignments (for iCal sync).
   * Returns array of created/updated assignments.
   */
  bulkUpsertAssignments(inputs: AssignmentInput[]): Assignment[] {
    const now = Date.now();
    const results: Assignment[] = [];

    exec('BEGIN TRANSACTION');
    try {
      for (const input of inputs) {
        const id = input.id ?? randomUUID();

        const dbRow = mapAssignmentInputToDb(input, now);

        // Build dynamic INSERT/UPDATE based on provided fields
        const columns: string[] = ['id'];
        const values: (string | number | null)[] = [id];
        const updates: string[] = [];

        if (dbRow.canvas_id !== undefined) { columns.push('canvas_id'); values.push(dbRow.canvas_id); updates.push('canvas_id = excluded.canvas_id'); }
        if (dbRow.title !== undefined) { columns.push('title'); values.push(dbRow.title); updates.push('title = excluded.title'); }
        if (dbRow.description !== undefined) { columns.push('description'); values.push(dbRow.description); updates.push('description = excluded.description'); }
        if (dbRow.course_name !== undefined) { columns.push('course_name'); values.push(dbRow.course_name); updates.push('course_name = excluded.course_name'); }
        if (dbRow.course_color !== undefined) { columns.push('course_color'); values.push(dbRow.course_color); updates.push('course_color = excluded.course_color'); }
        if (dbRow.due_at !== undefined) { columns.push('due_at'); values.push(dbRow.due_at); updates.push('due_at = excluded.due_at'); }
        if (dbRow.unlock_at !== undefined) { columns.push('unlock_at'); values.push(dbRow.unlock_at); updates.push('unlock_at = excluded.unlock_at'); }
        if (dbRow.lock_at !== undefined) { columns.push('lock_at'); values.push(dbRow.lock_at); updates.push('lock_at = excluded.lock_at'); }
        if (dbRow.points_possible !== undefined) { columns.push('points_possible'); values.push(dbRow.points_possible); updates.push('points_possible = excluded.points_possible'); }
        if (dbRow.submission_types !== undefined) { columns.push('submission_types'); values.push(dbRow.submission_types); updates.push('submission_types = excluded.submission_types'); }
        if (dbRow.workflow_state !== undefined) { columns.push('workflow_state'); values.push(dbRow.workflow_state); updates.push('workflow_state = excluded.workflow_state'); }
        if (dbRow.html_url !== undefined) { columns.push('html_url'); values.push(dbRow.html_url); updates.push('html_url = excluded.html_url'); }
        if (dbRow.ical_uid !== undefined) { columns.push('ical_uid'); values.push(dbRow.ical_uid); updates.push('ical_uid = excluded.ical_uid'); }
        if (dbRow.status !== undefined) { columns.push('status'); values.push(dbRow.status); updates.push('status = excluded.status'); }
        if (dbRow.source !== undefined) { columns.push('source'); values.push(dbRow.source); updates.push('source = excluded.source'); }
        if (dbRow.source_url !== undefined) { columns.push('source_url'); values.push(dbRow.source_url); updates.push('source_url = excluded.source_url'); }
        if (dbRow.rrule !== undefined) { columns.push('rrule'); values.push(dbRow.rrule); updates.push('rrule = excluded.rrule'); }
        if (dbRow.created_at !== undefined) { columns.push('created_at'); values.push(dbRow.created_at); }
        if (dbRow.updated_at !== undefined) { columns.push('updated_at'); values.push(dbRow.updated_at); updates.push('updated_at = excluded.updated_at'); }

        // Always update updated_at on conflict
        if (!updates.some(u => u.startsWith('updated_at'))) {
          updates.push('updated_at = excluded.updated_at');
        }

        const placeholders = columns.map(() => '?').join(', ');
        const sql = `
          INSERT INTO assignments (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}
        `;

        run(sql, values);

        const row = get<DbAssignment>('SELECT * FROM assignments WHERE id = ?', [id]);
        if (row) results.push(mapDbAssignmentToAssignment(row));
      }
      exec('COMMIT');
    } catch (e) {
      exec('ROLLBACK');
      throw e;
    }

    return results;
  },

  // --- Priority Order ---

  /**
   * Get all assignment IDs in priority order (0 = highest priority).
   */
  getPriorityOrder(): string[] {
    const rows = all<{ assignment_id: string }>(
      'SELECT assignment_id FROM priority_order ORDER BY position ASC',
    );
    return rows.map((r) => r.assignment_id);
  },

  /**
   * Set the complete priority order from an array of assignment IDs.
   * Replaces all existing priority order entries.
   */
  setPriorityOrder(ids: string[]): void {
    exec('BEGIN TRANSACTION');
    try {
      // Clear existing
      run('DELETE FROM priority_order');
      // Insert new order
      for (let i = 0; i < ids.length; i++) {
        run('INSERT OR REPLACE INTO priority_order (assignment_id, position) VALUES (?, ?)', [
          ids[i]!,
          i,
        ]);
      }
      exec('COMMIT');
    } catch (e) {
      exec('ROLLBACK');
      throw e;
    }
  },

  /**
   * Upsert a single priority order entry.
   */
  upsertPriorityOrder(input: PriorityOrderInput): PriorityOrder {
    const now = Date.now();
    run('INSERT OR REPLACE INTO priority_order (assignment_id, position) VALUES (?, ?)', [
      input.assignmentId,
      input.order,
    ]);
    return {
      id: input.assignmentId,
      assignmentId: input.assignmentId,
      order: input.order,
      updatedAt: toIsoDateTime(now) as PriorityOrder['updatedAt'],
    };
  },

  // --- Sub-tasks ---

  /**
   * List all sub-tasks for an assignment, ordered by position.
   */
  listSubTasks(assignmentId: string): SubTask[] {
    const rows = all<DbSubTask>(
      'SELECT * FROM sub_tasks WHERE assignment_id = ? ORDER BY position ASC',
      [assignmentId],
    );
    return rows.map(mapDbSubTaskToSubTask);
  },

  /**
   * Insert or update a sub-task.
   */
  upsertSubTask(input: SubTaskInput): SubTask {
    const now = Date.now();
    const dbInput = mapSubTaskInputToDb(input, now);

    run(
      `
      INSERT INTO sub_tasks (id, assignment_id, title, completed, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        assignment_id = excluded.assignment_id,
        title = excluded.title,
        completed = excluded.completed,
        position = excluded.position,
        updated_at = excluded.updated_at
    `,
      [
        dbInput.id,
        dbInput.assignment_id,
        dbInput.title,
        dbInput.completed,
        dbInput.position,
        now,
        now,
      ],
    );

    const row = get<DbSubTask>('SELECT * FROM sub_tasks WHERE id = ?', [dbInput.id]);
    if (!row) throw new Error('Failed to retrieve upserted sub-task');
    return mapDbSubTaskToSubTask(row);
  },

  /**
   * Delete a sub-task by ID.
   */
  deleteSubTask(id: string): void {
    run('DELETE FROM sub_tasks WHERE id = ?', [id]);
  },

  /**
   * Reorder sub-tasks for an assignment.
   * Updates positions based on the provided ordered array of IDs.
   */
  reorderSubTasks(assignmentId: string, ids: string[]): void {
    const now = Date.now();
    exec('BEGIN TRANSACTION');
    try {
      for (let i = 0; i < ids.length; i++) {
        run('UPDATE sub_tasks SET position = ?, updated_at = ? WHERE id = ?', [i, now, ids[i]!]);
      }
      exec('COMMIT');
    } catch (e) {
      exec('ROLLBACK');
      throw e;
    }
  },

  // --- Notes ---

  /**
   * Get the note for an assignment.
   */
  getNote(assignmentId: string): Note | null {
    const row = get<{ assignment_id: string; content: string; updated_at: number }>(
      'SELECT * FROM notes WHERE assignment_id = ?',
      [assignmentId],
    );
    if (!row) return null;
    return {
      id: row.assignment_id as Note['id'],
      assignmentId: row.assignment_id as Note['assignmentId'],
      content: row.content,
      createdAt: toIsoDateTime(row.updated_at) as Note['createdAt'],
      updatedAt: toIsoDateTime(row.updated_at) as Note['updatedAt'],
    };
  },

  /**
   * Set (create or update) the note for an assignment.
   */
  setNote(assignmentId: string, content: string): Note {
    const now = Date.now();
    run(
      `
      INSERT INTO notes (assignment_id, content, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET
        content = excluded.content,
        updated_at = excluded.updated_at
    `,
      [assignmentId, content, now],
    );
    return {
      id: assignmentId as Note['id'],
      assignmentId: assignmentId as Note['assignmentId'],
      content,
      createdAt: toIsoDateTime(now) as Note['createdAt'],
      updatedAt: toIsoDateTime(now) as Note['updatedAt'],
    };
  },

  // --- Settings ---

  /**
   * Get a setting value with a default fallback.
   */
  getSetting<T>(key: string, defaultValue: T): T {
    const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Set a setting value (JSON stringified).
   */
  setSetting<T>(key: string, value: T): void {
    run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)],
    );
  },

  /**
   * Get all settings as a Settings object.
   */
  getAllSettings(): Settings {
    const rows = all<DbSettings>('SELECT * FROM settings');
    return mapDbSettingsToSettings(rows);
  },
};
