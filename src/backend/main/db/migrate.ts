/**
 * Database Migration Runner — Main Process
 *
 * Applies pending migrations sequentially on startup.
 * Tracks applied migrations in `schema_version` table.
 *
 * @module @backend/main/db/migrate
 */

import type { DatabaseSync } from 'node:sqlite';

/**
 * Migration SQL statements by version.
 * Each migration should be a single transaction (exec handles this).
 */
const MIGRATIONS: Record<number, string> = {
  1: `
    -- Core assignments from iCal + user extensions
    CREATE TABLE assignments (
      id TEXT PRIMARY KEY,
      canvas_id TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      course_name TEXT NOT NULL,
      course_color TEXT,
      due_at INTEGER NOT NULL,
      unlock_at INTEGER,
      lock_at INTEGER,
      points_possible REAL,
      submission_types TEXT,
      workflow_state TEXT,
      html_url TEXT,
      ical_uid TEXT UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- User-defined priority (drag-drop order)
    CREATE TABLE priority_order (
      assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
      position INTEGER NOT NULL UNIQUE
    );

    -- Sub-tasks / checklist per assignment
    CREATE TABLE sub_tasks (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Notes per assignment
    CREATE TABLE notes (
      assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    -- App settings (key-value, single row per key)
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Migration tracking
    CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    -- Indexes
    CREATE INDEX idx_assignments_due_at ON assignments(due_at);
    CREATE INDEX idx_assignments_course ON assignments(course_name);
    CREATE INDEX idx_sub_tasks_assignment ON sub_tasks(assignment_id, position);
  `,
};

/**
 * Run all pending migrations on the given database.
 * Creates schema_version table if it doesn't exist.
 *
 * @param db - DatabaseSync instance to migrate
 * @throws {Error} If any migration fails
 */
export function migrate(db: DatabaseSync): void {
  // Ensure schema_version table exists (for fresh databases)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  // Get current schema version
  const row = db
    .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined;
  const currentVersion = row?.version ?? 0;

  // Apply pending migrations
  const maxVersion = Math.max(...Object.keys(MIGRATIONS).map(Number));

  for (let version = currentVersion + 1; version <= maxVersion; version++) {
    const migrationSql = MIGRATIONS[version];
    if (!migrationSql) {
      throw new Error(`Missing migration for version ${version}`);
    }

    // Execute migration in a transaction
    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec(migrationSql);
      db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
        version,
        Date.now(),
      );
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw new Error(
        `Migration ${version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Get the current schema version.
 *
 * @param db - DatabaseSync instance
 * @returns Current schema version (0 if no migrations applied)
 */
export function getCurrentVersion(db: DatabaseSync): number {
  const row = db
    .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined;
  return row?.version ?? 0;
}
