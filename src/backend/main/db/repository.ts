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
  SubTask,
  SubTaskInput,
  Note,
  PriorityOrder,
  PriorityOrderInput,
  Settings,
  DbAssignment,
  DbSubTask,
  DbSettings,
} from '../../shared/types.js';

import { getDatabase, saveDatabase } from './connection.js';

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
    dueDate: toIsoDateTime(row.due_at) as Assignment['dueDate'],
    // Derive priority from due date (sooner = higher priority)
    priority: row.due_at,
    // Map workflow_state to status
    status: (row.workflow_state as Assignment['status']) ?? 'pending',
    // Determine source from ical_uid
    source: row.ical_uid ? 'ical' : 'manual',
    sourceUrl: row.html_url ?? row.ical_uid,
    createdAt: toIsoDateTime(row.created_at) as Assignment['createdAt'],
    updatedAt: toIsoDateTime(row.updated_at) as Assignment['updatedAt'],
  };
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
    const id = randomUUID();

    run(
      `
      INSERT INTO assignments (
        id, canvas_id, title, description, course_name, course_color,
        due_at, unlock_at, lock_at, points_possible, submission_types,
        workflow_state, html_url, ical_uid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    `,
      [
        id,
        null,
        input.title,
        input.description,
        input.courseId ?? '',
        null,
        toUnixMs(input.dueDate) ?? now,
        null,
        null,
        null,
        null,
        input.status,
        input.sourceUrl,
        input.source === 'ical' ? input.sourceUrl : null,
        now,
        now,
      ],
    );

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
   * Bulk upsert assignments (for iCal sync).
   * Returns array of created/updated assignments.
   */
  bulkUpsertAssignments(inputs: AssignmentInput[]): Assignment[] {
    const now = Date.now();
    const results: Assignment[] = [];

    exec('BEGIN TRANSACTION');
    try {
      for (const input of inputs) {
        const id = randomUUID();
        run(
          `
          INSERT INTO assignments (
            id, canvas_id, title, description, course_name, course_color,
            due_at, unlock_at, lock_at, points_possible, submission_types,
            workflow_state, html_url, ical_uid, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        `,
          [
            id,
            null,
            input.title,
            input.description,
            input.courseId ?? '',
            null,
            toUnixMs(input.dueDate) ?? now,
            null,
            null,
            null,
            null,
            input.status,
            input.sourceUrl,
            input.source === 'ical' ? input.sourceUrl : null,
            now,
            now,
          ],
        );

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
