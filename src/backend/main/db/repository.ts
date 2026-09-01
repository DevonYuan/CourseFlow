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
  ImportResult,
} from '../../shared/types.js';

import { sendEventToRenderers } from '../events.js';
import type { EncryptedSetting } from '../security/encryption.js';
import { encryptIcalUrl, decryptIcalUrl, isEncryptedSetting, EncryptionError, DecryptionError } from '../security/encryption.js';
import { getDatabase, saveDatabase } from './connection.js';
import {
  mapDbAssignmentToAssignment,
  mapAssignmentInputToDb,
  mapDbSubTaskToSubTask,
  mapSubTaskInputToDb,
  mapDbSettingsToSettings,
  toIsoDateTime,
  toUnixMs,
} from './mappers.js';

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
  importAssignments(inputs: AssignmentInput[]): ImportResult {
    const now = Date.now();
    const result: ImportResult = { imported: 0, skipped: 0, updated: 0 };

    // Prepared statements for performance
    const db = getDatabase();

    const selectStmt = db.prepare('SELECT id, description, status, updated_at FROM assignments WHERE ical_uid = ?');
    const insertStmt = db.prepare(`
      INSERT INTO assignments (id, canvas_id, title, description, course_name, course_color, due_at, unlock_at, lock_at,
        points_possible, submission_types, workflow_state, html_url, ical_uid, status, source, source_url, rrule, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStmt = db.prepare(`
      UPDATE assignments SET
        title = ?, due_at = ?, workflow_state = ?, html_url = ?, course_color = ?, points_possible = ?,
        submission_types = ?, unlock_at = ?, lock_at = ?, rrule = ?, source = ?, source_url = ?, status = ?, updated_at = ?
      WHERE id = ?
    `);

    // Helper to convert undefined to null for SQL binding
    const toNullable = (v: unknown): string | number | null => (v === undefined ? null : v as string | number | null);

    exec('BEGIN TRANSACTION');
    try {
      for (const input of inputs) {
        const icalUid = input.icalUid;
        if (!icalUid) {
          // Skip assignments without ical_uid (should not happen in normal iCal import)
          continue;
        }

        // Check if assignment with this ical_uid exists
        selectStmt.bind([icalUid]);
        const existing = selectStmt.step() ? selectStmt.getAsObject() : null;
        selectStmt.reset();

        const incomingUpdatedAt = input.updatedAt ? new Date(input.updatedAt).getTime() : now;

        if (!existing) {
          // INSERT: new ical_uid
          const id = input.id ?? randomUUID();
          const dbRow = mapAssignmentInputToDb(input, now);

          insertStmt.bind([
            id,
            dbRow.canvas_id ?? null,
            dbRow.title ?? '',
            dbRow.description ?? '',
            dbRow.course_name ?? '',
            dbRow.course_color ?? '#6366f1',
            dbRow.due_at ?? now,
            dbRow.unlock_at ?? null,
            dbRow.lock_at ?? null,
            dbRow.points_possible ?? null,
            dbRow.submission_types ?? '[]',
            dbRow.workflow_state ?? 'published',
            dbRow.html_url ?? '',
            dbRow.ical_uid ?? '',
            dbRow.status ?? 'pending',
            dbRow.source ?? 'ical',
            dbRow.source_url ?? null,
            dbRow.rrule ?? null,
            dbRow.created_at ?? now,
            dbRow.updated_at ?? now,
          ]);
          insertStmt.step();
          insertStmt.reset();

          result.imported++;
          sendEventToRenderers('db:changed', { table: 'assignments', action: 'insert', id });
        } else {
          // Check if incoming is newer
          const storedUpdatedAt = existing['updated_at'] as number;
          if (incomingUpdatedAt > storedUpdatedAt) {
            // UPDATE: incoming is newer — but preserve protected fields
            const existingId = existing['id'] as string;
            const existingDescription = (existing['description'] as string) ?? '';
            const existingStatus = (existing['status'] as string) ?? 'pending';
            // Priority is stored in priority_order table, not in assignments

            // Update safe-to-overwrite fields (including status, which we may restore after)
            updateStmt.bind([
              input.title ?? existing['title'] ?? '', // title
              input.dueAt ? new Date(input.dueAt).getTime() : toNullable(existing['due_at']), // due_at
              input.workflowState ?? existing['workflow_state'] ?? 'published', // workflow_state
              input.htmlUrl ?? existing['html_url'] ?? '', // html_url
              input.courseColor ?? existing['course_color'] ?? '#6366f1', // course_color
              input.pointsPossible ?? toNullable(existing['points_possible']), // points_possible
              input.submissionTypes ? JSON.stringify(input.submissionTypes) : toNullable(existing['submission_types']), // submission_types
              input.unlockAt ? new Date(input.unlockAt).getTime() : toNullable(existing['unlock_at']), // unlock_at
              input.lockAt ? new Date(input.lockAt).getTime() : toNullable(existing['lock_at']), // lock_at
              input.rrule ?? toNullable(existing['rrule']), // rrule
              input.source ?? existing['source'] ?? 'ical', // source
              input.sourceUrl ?? toNullable(existing['source_url']), // source_url
              input.status ?? existingStatus, // status (may be restored below if protected)
              now, // updated_at
              existingId, // WHERE id = ?
            ]);
            updateStmt.step();
            updateStmt.reset();

            // Preserve protected fields by restoring them if they were overwritten
            // Description: restore user-edited description
            if (existingDescription && input.description !== undefined && input.description !== existingDescription) {
              run('UPDATE assignments SET description = ? WHERE id = ?', [existingDescription, existingId]);
            }
            // Status: preserve if user marked as completed (or archived in future)
            if (existingStatus === 'completed' && input.status !== undefined && input.status !== 'completed') {
              run('UPDATE assignments SET status = ? WHERE id = ?', ['completed', existingId]);
            }
            // Priority: stored in priority_order table, not affected by assignment UPDATE

            result.updated++;
            sendEventToRenderers('db:changed', { table: 'assignments', action: 'update', id: existingId });
          } else {
            // SKIP: incoming is not newer
            result.skipped++;
          }
        }
      }
      exec('COMMIT');
    } catch (e) {
      exec('ROLLBACK');
      throw e;
    } finally {
      selectStmt.free();
      insertStmt.free();
      updateStmt.free();
    }

    return result;
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
   * Automatically decrypts 'icalUrl' if encrypted.
   */
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    if (!row) return defaultValue;
    try {
      const parsed = JSON.parse(row.value);
      // Decrypt icalUrl if it's encrypted
      if (key === 'icalUrl' && isEncryptedSetting(parsed)) {
        const decrypted = await decryptIcalUrl(parsed);
        return decrypted as T;
      }
      return parsed as T;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Set a setting value (JSON stringified).
   * Automatically encrypts 'icalUrl' before storing.
   */
  async setSetting<T>(key: string, value: T): Promise<void> {
    let valueToStore: T = value;
    // Encrypt icalUrl before storing
    if (key === 'icalUrl' && typeof value === 'string' && value.length > 0) {
      const encrypted = await encryptIcalUrl(value);
      valueToStore = JSON.stringify(encrypted) as T;
    }
    run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(valueToStore)],
    );
  },

  /**
   * Get all settings as a Settings object.
   * Automatically decrypts 'icalUrl' if encrypted.
   */
  async getAllSettings(): Promise<Settings> {
    const rows = all<DbSettings>('SELECT * FROM settings');
    const settings = mapDbSettingsToSettings(rows);

    // Decrypt icalUrl if it's encrypted
    const icalUrlRow = rows.find((r) => r.key === 'icalUrl');
    if (icalUrlRow) {
      try {
        const parsed = JSON.parse(icalUrlRow.value);
        if (isEncryptedSetting(parsed)) {
          settings.icalUrl = await decryptIcalUrl(parsed);
        }
      } catch {
        // If decryption fails, reset to default empty string
        settings.icalUrl = '';
      }
    }

    return settings;
  },

  /**
   * Set multiple settings at once (merge with existing).
   * Automatically encrypts 'icalUrl' before storing.
   * Uses a single transaction for atomicity.
   */
  async setSettings(partial: Partial<Settings>): Promise<Settings> {
    const current = await this.getAllSettings();
    const merged = { ...current, ...partial };

    // Recompute autoFetchIntervalMs if icalFetchIntervalMinutes changed
    if (partial.icalFetchIntervalMinutes !== undefined) {
      merged.autoFetchIntervalMs = partial.icalFetchIntervalMinutes * 60 * 1000;
    }

    exec('BEGIN TRANSACTION');
    try {
      for (const [key, value] of Object.entries(merged)) {
        let valueToStore: unknown = value;
        // Encrypt icalUrl before storing
        if (key === 'icalUrl' && typeof value === 'string' && value.length > 0) {
          const encrypted = await encryptIcalUrl(value);
          valueToStore = encrypted;
        }
        // Don't persist autoFetchIntervalMs (computed field)
        if (key !== 'autoFetchIntervalMs') {
          run(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            [key, JSON.stringify(valueToStore)],
          );
        }
      }
      exec('COMMIT');
    } catch (e) {
      exec('ROLLBACK');
      throw e;
    }

    // Emit settings changed event
    sendEventToRenderers('settings:changed', merged);
    return merged;
  },

  /**
   * Reset all settings to defaults.
   * Clears the settings table and re-inserts default values.
   */
  async resetSettings(): Promise<Settings> {
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

    exec('BEGIN TRANSACTION');
    try {
      run('DELETE FROM settings');
      // Insert all defaults
      for (const [key, value] of Object.entries(defaults)) {
        let valueToStore: unknown = value;
        if (key === 'icalUrl' && typeof value === 'string' && value.length > 0) {
          const encrypted = await encryptIcalUrl(value);
          valueToStore = encrypted;
        }
        run(
          'INSERT INTO settings (key, value) VALUES (?, ?)',
          [key, JSON.stringify(valueToStore)],
        );
      }
      exec('COMMIT');
    } catch (e) {
      exec('ROLLBACK');
      throw e;
    }

    // Emit settings changed event
    sendEventToRenderers('settings:changed', defaults);
    return defaults;
  },
};
