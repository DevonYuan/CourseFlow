/**
 * Database Migration Runner — Main Process
 *
 * Applies pending migrations sequentially on startup.
 * Tracks applied migrations in `schema_version` table.
 *
 * @module @backend/main/db/migrate
 */
import type { Database } from 'sql.js';
/**
 * Run all pending migrations on the given database.
 * Creates schema_version table if it doesn't exist.
 *
 * @param db - sql.js Database instance to migrate
 * @throws {Error} If any migration fails
 */
export declare function migrate(db: Database): void;
/**
 * Get the current schema version.
 *
 * @param db - sql.js Database instance
 * @returns Current schema version (0 if no migrations applied)
 */
export declare function getCurrentVersion(db: Database): number;
//# sourceMappingURL=migrate.d.ts.map