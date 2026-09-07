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
  NoteInput,
  PriorityOrder,
  PriorityOrderInput,
  Settings,
  DbAssignment,
  DbSubTask,
  DbNote,
  DbPriorityOrder,
  DbSettings,
  ImportResult,
} from '../../shared/types.js';
import { sendEventToRenderers } from '../events.js';
import { encryptIcalUrl, decryptIcalUrl, isEncryptedSetting } from '../security/encryption.js';

import { getDatabase, saveDatabase } from './connection.js';
import {
  mapDbAssignmentToAssignment,
  mapAssignmentInputToDb,
  mapDbSubTaskToSubTask,
  mapSubTaskInputToDb,
  mapDbNoteToNote,
  mapNoteInputToDb,
  mapDbSettingsToSettings,
  mapPriorityOrderRow,
  mapPriorityOrderInputToDb,
} from './mappers.js';

// ============================================================================
// SQL Helpers
// ============================================================================

/**
 * Executes a SQL statement (INSERT/UPDATE/DELETE).
 * @param sql - SQL to execute
 * @param params - Parameters to bind
 * @param persist - Whether to save to disk after execution (default: true). Set to false when called inside a transaction to avoid exporting mid-transaction.
 */
function run(sql: string, params: (string | number | null)[] = [], persist = true): void {
  const db = getDatabase();
  db.run(sql, params);
  if (persist) saveDatabase();
}

function get<T>(sql: string, params: (string | number | null)[] = []): T | null {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  // sql.js requires advancing to the first row before reading it
  const result = stmt.step() ? (stmt.getAsObject() as T) : null;
  stmt.free();
  return result;
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

/**
 * Executes a SQL statement.
 * @param sql - SQL to execute
 * @param persist - Whether to save to disk after execution (default: true). Set to false for transaction control statements (BEGIN/COMMIT/ROLLBACK) to avoid exporting mid-transaction.
 */
function exec(sql: string, persist = true): void {
  const db = getDatabase();
  db.exec(sql);
  if (persist) saveDatabase();
}

/**
 * Helper to convert undefined to null for SQL binding.
 */
function toNullable(v: unknown): string | number | null {
  return v === undefined ? null : (v as string | number | null);
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
   *
   * Partial updates (e.g. marking complete with only `{ id, status }`) are
   * applied via UPDATE when the row already exists, so the omitted NOT NULL
   * columns don't cause an INSERT ... ON CONFLICT constraint failure.
   */
  upsertAssignment(input: AssignmentInput): Assignment {
    const now = Date.now();
    // Use provided ID or generate new one
    const id = input.id ?? randomUUID();

    const dbRow = mapAssignmentInputToDb(input, now);

    const existing = get<DbAssignment>('SELECT id FROM assignments WHERE id = ?', [id]);

    if (existing) {
      // ── UPDATE path (row exists) ─────────────────────────────────────────
      const updates: string[] = [];
      const values: (string | number | null)[] = [];
      const setColumn = (column: string, value: string | number | null | undefined): void => {
        if (value !== undefined) {
          updates.push(`${column} = ?`);
          values.push(value);
        }
      };

      setColumn('canvas_id', dbRow.canvas_id);
      setColumn('title', dbRow.title);
      setColumn('description', dbRow.description);
      setColumn('course_name', dbRow.course_name);
      setColumn('course_color', dbRow.course_color);
      setColumn('due_at', dbRow.due_at);
      setColumn('unlock_at', dbRow.unlock_at);
      setColumn('lock_at', dbRow.lock_at);
      setColumn('points_possible', dbRow.points_possible);
      setColumn('submission_types', dbRow.submission_types);
      setColumn('workflow_state', dbRow.workflow_state);
      setColumn('html_url', dbRow.html_url);
      setColumn('ical_uid', dbRow.ical_uid);
      setColumn('status', dbRow.status);
      setColumn('source', dbRow.source);
      setColumn('source_url', dbRow.source_url);
      setColumn('rrule', dbRow.rrule);
      // created_at is immutable after creation
      setColumn('updated_at', now);

      if (updates.length === 0) {
        throw new Error('No fields provided to update assignment');
      }

      values.push(id);
      run(`UPDATE assignments SET ${updates.join(', ')} WHERE id = ?`, values);
    } else {
      // ── INSERT path (new assignment) ─────────────────────────────────────
      // Build dynamic INSERT based on provided fields.
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
    }

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

    exec('BEGIN TRANSACTION', false);
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

        run(sql, values, false); // Don't persist mid-transaction

        const row = get<DbAssignment>('SELECT * FROM assignments WHERE id = ?', [id]);
        if (row) results.push(mapDbAssignmentToAssignment(row));
      }
      exec('COMMIT', false);
    } catch (e) {
      exec('ROLLBACK', false);
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
   * On UPDATE, preserves user-edited fields: status (if completed or archived), priority, course_color, notes, subtasks.
   * Updates from Canvas: due_at, title, workflow_state, description.
   * Prunes stale `ical` rows (not in this batch) that the user hasn't completed/archived,
   * keeping the DB in sync with the feed + mapper window.
   * Emits db:changed events for each insert/update/delete.
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
        title = ?, due_at = ?, workflow_state = ?, html_url = ?, points_possible = ?,
        submission_types = ?, unlock_at = ?, lock_at = ?, rrule = ?, source = ?, source_url = ?, status = ?, updated_at = ?, description = ?
      WHERE id = ?
    `);
    const staleStmt = db.prepare(
      "SELECT id, ical_uid FROM assignments WHERE source = 'ical' AND status NOT IN ('completed', 'archived')"
    );
    const deleteStmt = db.prepare('DELETE FROM assignments WHERE id = ?');

    exec('BEGIN TRANSACTION', false);
    console.log('[importAssignments] Transaction started, inputs:', inputs.length);
    try {
      // Track ical_uids seen in this batch to handle duplicates within the same import
      // (e.g., recurring events in Google Calendar share the same UID)
      const seenIcalUids = new Set<string>();

      for (const input of inputs) {
        const icalUid = input.icalUid;
        if (!icalUid) {
          // Skip assignments without ical_uid (should not happen in normal iCal import)
          continue;
        }

        // Skip if we've already processed this ical_uid in this batch
        if (seenIcalUids.has(icalUid)) {
          result.skipped++;
          continue;
        }

        // Check if assignment with this ical_uid exists
        selectStmt.bind([icalUid]);
        const existing = selectStmt.step() ? selectStmt.getAsObject() : null;
        selectStmt.reset();

        const incomingUpdatedAt = input.updatedAt ? new Date(input.updatedAt).getTime() : now;

        if (existing) {
          // Check if incoming is newer
          const storedUpdatedAt = existing['updated_at'] as number;
          if (incomingUpdatedAt > storedUpdatedAt) {
            // UPDATE: incoming is newer — but preserve protected fields
            const existingId = existing['id'] as string;
            const existingStatus = (existing['status'] as string) ?? 'pending';

            // Update safe-to-overwrite fields from Canvas (including description)
            // Preserve: status (if completed), course_color, priority_order, notes, subtasks
            updateStmt.bind([
              input.title ?? existing['title'] ?? '', // title
              input.dueAt ? new Date(input.dueAt).getTime() : toNullable(existing['due_at']), // due_at
              input.workflowState ?? existing['workflow_state'] ?? 'published', // workflow_state
              input.htmlUrl ?? existing['html_url'] ?? '', // html_url
              input.pointsPossible ?? toNullable(existing['points_possible']), // points_possible
              input.submissionTypes ? JSON.stringify(input.submissionTypes) : toNullable(existing['submission_types']), // submission_types
              input.unlockAt ? new Date(input.unlockAt).getTime() : toNullable(existing['unlock_at']), // unlock_at
              input.lockAt ? new Date(input.lockAt).getTime() : toNullable(existing['lock_at']), // lock_at
              input.rrule ?? toNullable(existing['rrule']), // rrule
              input.source ?? existing['source'] ?? 'ical', // source
              input.sourceUrl ?? toNullable(existing['source_url']), // source_url
              input.status ?? existingStatus, // status (may be restored below if protected)
              now, // updated_at
              input.description ?? existing['description'] ?? '', // description (from Canvas)
              existingId, // WHERE id = ?
            ]);
            updateStmt.step();
            updateStmt.reset();

            // Preserve protected fields by restoring them if they were overwritten
            // Status: preserve if user marked as completed (or archived in future)
            if (existingStatus === 'completed' && input.status !== undefined && input.status !== 'completed') {
              run('UPDATE assignments SET status = ? WHERE id = ?', ['completed', existingId]);
            }
            // course_color: preserve user's course color (do not overwrite from Canvas)
            // Priority: stored in priority_order table, not affected by assignment UPDATE
            // Notes and Subtasks: separate tables, not affected

            result.updated++;
            sendEventToRenderers('db:changed', { table: 'assignments', action: 'update', id: existingId });
          } else {
            // SKIP: incoming is not newer
            result.skipped++;
          }
        } else {
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

          // Add priority_order entry for new assignment at end (max position + 1)
          run(
            `INSERT INTO priority_order (assignment_id, position, created_at, updated_at)
             VALUES (?, (SELECT COALESCE(MAX(position), -1) + 1 FROM priority_order), ?, ?)`,
            [id, now, now],
            false, // Don't persist mid-transaction
          );

          result.imported++;
          sendEventToRenderers('db:changed', { table: 'assignments', action: 'insert', id });
        }

        // Mark this ical_uid as seen in this batch
        seenIcalUids.add(icalUid);
      }

      // ── Prune stale iCal rows ───────────────────────────────────────────
      // The iCal feed is the single source of truth for `source='ical'`
      // assignments. Rows whose ical_uid is NOT in this import batch are stale:
      //   1. events that fell outside the mapper's date window (past 30 days →
      //      next 60 days), e.g. far-future/far-past calendar entries,
      //   2. events deleted/moved on the calendar since the last sync,
      //   3. legacy collapsed recurring "master" rows (due at UNTIL/now+1d)
      //      that have now been replaced by expanded per-occurrence rows.
      // Delete them so the list always mirrors the calendar. Rows the user
      // explicitly marked completed/archived are preserved.
      while (staleStmt.step()) {
        const stale = staleStmt.getAsObject() as { id: string; ical_uid: string };
        if (!seenIcalUids.has(stale.ical_uid)) {
          deleteStmt.bind([stale.id]);
          deleteStmt.step();
          deleteStmt.reset();
          sendEventToRenderers('db:changed', { table: 'assignments', action: 'delete', id: stale.id });
        }
      }

      console.log('[importAssignments] Committing transaction');
      exec('COMMIT', false);
      console.log('[importAssignments] Transaction committed');
    } catch (e) {
      console.error('[importAssignments] Error, rolling back:', e);
      exec('ROLLBACK', false);
      throw e;
    } finally {
      staleStmt.free();
      deleteStmt.free();
      selectStmt.free();
      insertStmt.free();
      updateStmt.free();
    }

    return result;
  },

  // --- Priority Order ---

  /**
   * Get all priority order entries ordered by position (0 = highest priority).
   */
  getAllPriorityOrders(): PriorityOrder[] {
    const rows = all<DbPriorityOrder>(
      'SELECT * FROM priority_order ORDER BY position ASC',
    );
    return rows.map(mapPriorityOrderRow);
  },

  /**
   * Get a single priority order entry by assignment ID.
   */
  getPriorityOrderByAssignmentId(assignmentId: string): PriorityOrder | null {
    const row = get<DbPriorityOrder>(
      'SELECT * FROM priority_order WHERE assignment_id = ?',
      [assignmentId],
    );
    return row ? mapPriorityOrderRow(row) : null;
  },

  /**
   * Insert or update a priority order entry.
   * Uses created_at/updated_at timestamps for audit trail.
   */
  upsertPriorityOrder(input: PriorityOrderInput): PriorityOrder {
    const now = Date.now();
    const dbRow = mapPriorityOrderInputToDb(input, now);

    run(
      `
      INSERT INTO priority_order (assignment_id, position, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET
        position = excluded.position,
        updated_at = excluded.updated_at
    `,
      [dbRow.assignment_id, dbRow.position, dbRow.created_at, dbRow.updated_at],
    );

    const row = get<DbPriorityOrder>('SELECT * FROM priority_order WHERE assignment_id = ?', [
      input.assignmentId,
    ]);
    if (!row) throw new Error('Failed to retrieve upserted priority order');
    return mapPriorityOrderRow(row);
  },

  /**
   * Bulk reorder priority entries in a single transaction.
   * All-or-nothing: if any update fails, the entire operation rolls back.
   * Positions are assigned as contiguous integers starting from 0.
   */
  reorderPriority(orderedAssignmentIds: string[]): void {
    const now = Date.now();
    exec('BEGIN IMMEDIATE TRANSACTION', false);
    try {
      for (let i = 0; i < orderedAssignmentIds.length; i++) {
        run(
          'UPDATE priority_order SET position = ?, updated_at = ? WHERE assignment_id = ?',
          [i, now, orderedAssignmentIds[i]!],
        );
      }
      exec('COMMIT', false);
    } catch (e) {
      exec('ROLLBACK', false);
      throw e;
    }
  },

  /**
   * Delete a priority order entry by assignment ID.
   * Called when an assignment is deleted (cascade via FK also handles this).
   */
  deletePriorityOrder(assignmentId: string): void {
    run('DELETE FROM priority_order WHERE assignment_id = ?', [assignmentId]);
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
   * Get a single sub-task by ID.
   */
  getSubTask(id: string): SubTask | null {
    const row = get<DbSubTask>('SELECT * FROM sub_tasks WHERE id = ?', [id]);
    return row ? mapDbSubTaskToSubTask(row) : null;
  },

  /**
   * Insert or update a sub-task.
   */
  upsertSubTask(input: SubTaskInput): SubTask {
    const now = Date.now();
    const dbInput = mapSubTaskInputToDb(input, now);
    // Generate ID for new sub-tasks (input doesn't have id)
    const id = randomUUID();

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
        id,
        dbInput.assignment_id,
        dbInput.title,
        dbInput.completed,
        dbInput.position,
        now,
        now,
      ],
    );

    const row = get<DbSubTask>('SELECT * FROM sub_tasks WHERE id = ?', [id]);
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
    exec('BEGIN TRANSACTION', false);
    try {
      for (let i = 0; i < ids.length; i++) {
        run('UPDATE sub_tasks SET position = ?, updated_at = ? WHERE id = ?', [i, now, ids[i]!]);
      }
      exec('COMMIT', false);
    } catch (e) {
      exec('ROLLBACK', false);
      throw e;
    }
  },

  // --- Notes ---

  /**
   * List all notes for an assignment, ordered by created_at DESC (newest first).
   */
  listNotes(assignmentId: string): Note[] {
    const rows = all<DbNote>(
      'SELECT * FROM notes WHERE assignment_id = ? ORDER BY created_at DESC',
      [assignmentId],
    );
    return rows.map(mapDbNoteToNote);
  },

  /**
   * Get a single note by ID.
   */
  getNote(id: string): Note | null {
    const row = get<DbNote>('SELECT * FROM notes WHERE id = ?', [id]);
    return row ? mapDbNoteToNote(row) : null;
  },

  /**
   * Insert a new note for an assignment (1:N model - multiple log entries).
   */
  upsertNote(input: NoteInput): Note {
    const now = Date.now();
    const dbInput = mapNoteInputToDb(input, now);
    const id = randomUUID();

    run(
      `
      INSERT INTO notes (id, assignment_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      [id, dbInput.assignment_id, dbInput.content, now, now],
    );

    const row = get<DbNote>('SELECT * FROM notes WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to retrieve inserted note');
    return mapDbNoteToNote(row);
  },

  /**
   * Delete a note by ID.
   */
  deleteNote(id: string): void {
    run('DELETE FROM notes WHERE id = ?', [id]);
  },

  /**
   * Update a note's content by ID.
   */
  updateNote(id: string, content: string): Note | null {
    const now = Date.now();
    run(
      'UPDATE notes SET content = ?, updated_at = ? WHERE id = ?',
      [content, now, id],
    );
    return this.getNote(id);
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

    // Ensure syncIntervalMinutes has a default if not in DB
    if (settings.syncIntervalMinutes === undefined) {
      settings.syncIntervalMinutes = 15;
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

    exec('BEGIN TRANSACTION', false);
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
            false, // Don't persist mid-transaction
          );
        }
      }
      exec('COMMIT', false);
    } catch (e) {
      exec('ROLLBACK', false);
      throw e;
    }

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
      syncIntervalMinutes: 15,
    };

    exec('BEGIN TRANSACTION', false);
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
      exec('COMMIT', false);
    } catch (e) {
      exec('ROLLBACK', false);
      throw e;
    }

    return defaults;
  },
};
