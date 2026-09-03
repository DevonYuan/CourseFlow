#!/usr/bin/env node
/**
 * Standalone migration runner for development.
 * Run with: pnpm tsx scripts/run-migration.ts
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load migration files
const migrationsDir = join(__dirname, '../src/backend/main/db/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

async function runMigrations() {
  // Database path
  const userDataPath = join(homedir(), 'Library/Application Support/CourseFlow');
  const dbPath = join(userDataPath, 'courseflow.db');

  // Load sql.js WASM
  const wasmPath = join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmBuffer = readFileSync(wasmPath);
  const SQL = await initSqlJs({
    wasmBinary: new Uint8Array(wasmBuffer).buffer,
  });

  // Load existing database or create new
  let fileBuffer: Uint8Array | null = null;
  if (existsSync(dbPath)) {
    console.log(`Loading existing database from ${dbPath}`);
    fileBuffer = readFileSync(dbPath);
  } else {
    console.log('Creating new database');
  }

  const db = new SQL.Database(fileBuffer);

  // Enable pragmas
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA cache_size = -32768;');
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA mmap_size = 268435456;');

  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get applied versions
  const appliedStmt = db.prepare('SELECT version FROM schema_migrations');
  const appliedVersions = new Set<number>();
  while (appliedStmt.step()) {
    const row = appliedStmt.getAsObject() as { version: number };
    appliedVersions.add(row.version);
  }
  appliedStmt.free();

  console.log(`Already applied migrations: ${Array.from(appliedVersions).join(', ') || 'none'}`);

  // Load and apply migrations
  for (const file of migrationFiles) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;
    const version = parseInt(match[1], 10);

    if (appliedVersions.has(version)) {
      console.log(`Skipping migration ${version} (already applied)`);
      continue;
    }

    console.log(`Applying migration ${version}...`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec(sql);
      const insertStmt = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime(\'now\'))');
      insertStmt.run([version]);
      insertStmt.free();
      db.exec('COMMIT;');
      console.log(`Migration ${version} applied successfully`);
    } catch (error) {
      db.exec('ROLLBACK;');
      console.error(`Migration ${version} failed:`, error);
      process.exit(1);
    }
  }

  // Save database
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
  console.log(`Database saved to ${dbPath}`);

  // Verify schema
  console.log('\n=== Schema Verification ===');
  const tables = ['assignments', 'settings', 'schema_migrations'];
  for (const table of tables) {
    const info = db.exec(`PRAGMA table_info(${table})`);
    if (info.length > 0 && info[0].values.length > 0) {
      console.log(`\n${table}:`);
      for (const row of info[0].values) {
        console.log(`  ${row[1]} (${row[2]})${row[3] ? ' NOT NULL' : ''}${row[4] !== null ? ` DEFAULT ${row[4]}` : ''}${row[5] ? ' PK' : ''}`);
      }
    }
  }

  // Check indexes
  const indexes = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='assignments'");
  if (indexes.length > 0 && indexes[0].values.length > 0) {
    console.log('\nIndexes on assignments:');
    for (const row of indexes[0].values) {
      console.log(`  ${row[0]}`);
    }
  }

  // Check migration records
  const migrations = db.exec('SELECT * FROM schema_migrations');
  if (migrations.length > 0 && migrations[0].values.length > 0) {
    console.log('\nApplied migrations:');
    for (const row of migrations[0].values) {
      console.log(`  v${row[0]} at ${row[1]}`);
    }
  }

  db.close();
  console.log('\n✅ Migration completed successfully!');
}

runMigrations().catch(console.error);