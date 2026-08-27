/**
 * Database Connection — Main Process
 *
 * SQLite connection using sql.js (WASM-based).
 * Opens database at `<userData>/courseflow.db` with WAL mode and foreign keys enabled.
 *
 * @module @backend/main/db/connection
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { app } from 'electron';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

let dbInstance: Database | null = null;
let dbPath: string | null = null;

/**
 * Get the database file path in the user's data directory.
 */
function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'courseflow.db');
}

/**
 * Get the path to the sql.js WASM file.
 * Copies from node_modules if not already in dist.
 */
function getWasmPath(): string {
  // In development, __dirname is .../dist/backend/main
  const distWasmPath = join(__dirname, 'sql-wasm.wasm');

  // If not in dist, copy from node_modules
  if (!existsSync(distWasmPath)) {
    const nodeModulesWasmPath = resolve(
      __dirname,
      '../../..',
      'node_modules/sql.js/dist/sql-wasm.wasm',
    );
    if (existsSync(nodeModulesWasmPath)) {
      copyFileSync(nodeModulesWasmPath, distWasmPath);
    }
  }

  return distWasmPath;
}

/**
 * Initialize the database connection.
 * Enables WAL mode and foreign key constraints.
 * Should be called once at application startup.
 */
export async function initializeDatabase(): Promise<Database> {
  if (dbInstance !== null) {
    return dbInstance;
  }

  dbPath = getDbPath();

  // Ensure directory exists
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Load sql.js WASM - read the WASM file directly
  const wasmPath = getWasmPath();
  const wasmBuffer = readFileSync(wasmPath);
  const SQL = await initSqlJs({
    wasmBinary: wasmBuffer,
  });

  // Load existing database or create new
  let fileBuffer: Uint8Array | null = null;
  if (existsSync(dbPath)) {
    fileBuffer = readFileSync(dbPath);
  }

  dbInstance = new SQL.Database(fileBuffer);

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
export function getDatabase(): Database {
  if (dbInstance === null) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

/**
 * Save the database to disk.
 */
export function saveDatabase(): void {
  if (dbInstance !== null && dbPath !== null) {
    const data = dbInstance.export();
    writeFileSync(dbPath, Buffer.from(data));
  }
}

/**
 * Close the database connection.
 * Should be called on application shutdown.
 */
export function closeDatabase(): void {
  if (dbInstance !== null) {
    saveDatabase();
    dbInstance.close();
    dbInstance = null;
    dbPath = null;
  }
}

/**
 * Check if database is initialized.
 */
export function isDatabaseInitialized(): boolean {
  return dbInstance !== null;
}
