/**
 * Database Migration Runner — Main Process
 *
 * Applies pending migrations sequentially on startup.
 * Tracks applied migrations in `schema_migrations` table.
 * Migrations are loaded from SQL files in `src/backend/main/db/migrations/`.
 *
 * @module @backend/main/db/migrate
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from 'sql.js';

/**
 * Load all migration files from the migrations directory.
 * Files must be named like `001_description.sql`, `002_description.sql`, etc.
 * Returns a map of version number to SQL content.
 */
function loadMigrations(): Map<number, string> {
  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // Lexicographic sort works for zero-padded versions

  const migrations = new Map<number, string>();

  for (const file of files) {
    // Extract version from filename (e.g., "001_initial_schema.sql" -> 1)
    const match = file.match(/^(\d+)_/);
    if (!match || !match[1]) {
      throw new Error(`Invalid migration filename: ${file}. Expected format: NNN_name.sql`);
    }
    const version = Number.parseInt(match[1], 10);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    migrations.set(version, sql);
  }

  if (migrations.size === 0) {
    throw new Error('No migration files found in migrations directory');
  }

  // Verify sequential versions starting from 1
  const versions = [...migrations.keys()].sort((a, b) => a - b);
  for (let i = 0; i < versions.length; i++) {
    if (versions[i] !== i + 1) {
      throw new Error(
        `Migration versions must be sequential starting from 1. Found: ${versions.join(', ')}`,
      );
    }
  }

  return migrations;
}

const MIGRATIONS = loadMigrations();

/**
 * Run all pending migrations on the given database.
 * Creates schema_migrations table if it doesn't exist.
 *
 * @param db - sql.js Database instance to migrate
 * @throws {Error} If any migration fails
 */
export function migrate(db: Database): void {
  // Ensure schema_migrations table exists (for fresh databases)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get all applied migration versions
  const appliedStmt = db.prepare('SELECT version FROM schema_migrations');
  const appliedVersions = new Set<number>();
  while (appliedStmt.step()) {
    const row = appliedStmt.getAsObject() as { version: number };
    appliedVersions.add(row.version);
  }
  appliedStmt.free();

  // Apply pending migrations in order
  const versions = [...MIGRATIONS.keys()].sort((a, b) => a - b);

  for (const version of versions) {
    if (appliedVersions.has(version)) {
      continue; // Already applied
    }

    const migrationSql = MIGRATIONS.get(version);
    if (!migrationSql) {
      throw new Error(`Missing migration for version ${version}`);
    }

    // Execute migration in a transaction
    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec(migrationSql);
      const insertStmt = db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))",
      );
      insertStmt.run([version]);
      insertStmt.free();
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
 * @param db - sql.js Database instance
 * @returns Current schema version (0 if no migrations applied)
 */
export function getCurrentVersion(db: Database): number {
  const stmt = db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
  const row = stmt.getAsObject() as { version: number } | undefined;
  stmt.free();
  return row?.version ?? 0;
}
