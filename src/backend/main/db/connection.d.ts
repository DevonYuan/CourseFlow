/**
 * Database Connection — Main Process
 *
 * SQLite connection using sql.js (WASM-based).
 * Opens database at `<userData>/courseflow.db` with WAL mode and foreign keys enabled.
 *
 * @module @backend/main/db/connection
 */
import type { Database } from 'sql.js';
/**
 * Initialize the database connection.
 * Enables WAL mode and foreign key constraints.
 * Should be called once at application startup.
 */
export declare function initializeDatabase(): Promise<Database>;
/**
 * Get the existing database instance.
 * Throws if database has not been initialized.
 */
export declare function getDatabase(): Database;
/**
 * Save the database to disk.
 */
export declare function saveDatabase(): void;
/**
 * Close the database connection.
 * Should be called on application shutdown.
 */
export declare function closeDatabase(): void;
/**
 * Check if database is initialized.
 */
export declare function isDatabaseInitialized(): boolean;
/**
 * Set a test database instance (for testing only).
 * This allows tests to inject their own database instance.
 */
export declare function setTestDatabase(db: Database | null): void;
//# sourceMappingURL=connection.d.ts.map