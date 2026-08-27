/**
 * Database Connection — Main Process
 *
 * Singleton `DatabaseSync` connection using Node's built-in `node:sqlite` module.
 * Opens database at `<userData>/courseflow.db` with WAL mode and foreign keys enabled.
 *
 * @module @backend/main/db/connection
 */

import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { app } from 'electron';

let dbInstance: DatabaseSync | null = null;

/**
 * Get the database file path in the user's data directory.
 */
function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'courseflow.db');
}

/**
 * Initialize the database connection.
 * Enables WAL mode and foreign key constraints.
 * Should be called once at application startup.
 */
export function initializeDatabase(): DatabaseSync {
  if (dbInstance !== null) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrency (readers don't block writers)
  dbInstance.exec('PRAGMA journal_mode = WAL;');

  // Enable foreign key constraints
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Set synchronous mode to NORMAL for good balance of safety/performance
  dbInstance.exec('PRAGMA synchronous = NORMAL;');

  // Set cache size to 32MB (negative = KB)
  dbInstance.exec('PRAGMA cache_size = -32768;');

  // Set temp store to memory
  dbInstance.exec('PRAGMA temp_store = MEMORY;');

  // Set mmap size to 256MB for better performance on large databases
  dbInstance.exec('PRAGMA mmap_size = 268435456;');

  return dbInstance;
}

/**
 * Get the existing database instance.
 * Throws if database has not been initialized.
 */
export function getDatabase(): DatabaseSync {
  if (dbInstance === null) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

/**
 * Close the database connection.
 * Should be called on application shutdown.
 */
export function closeDatabase(): void {
  if (dbInstance !== null) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Check if database is initialized.
 */
export function isDatabaseInitialized(): boolean {
  return dbInstance !== null;
}
