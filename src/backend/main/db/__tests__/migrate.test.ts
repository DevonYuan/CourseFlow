/**
 * Migration Runner Tests
 *
 * Runs the REAL migration files against a fresh sql.js database. This guards
 * against migrations that are incompatible with the WASM SQLite build — e.g.
 * a `CREATE VIRTUAL TABLE ... USING fts5(...)` statement, which fails with
 * "no such module: fts5" and aborts application startup.
 *
 * @module @backend/main/db/__tests__/migrate
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrate } from '../migrate.js';

let db: Database | null = null;

function queryOne<T>(sql: string): T | null {
  if (!db) throw new Error('db not initialized');
  const stmt = db.prepare(sql);
  const result = stmt.step() ? (stmt.getAsObject() as T) : null;
  stmt.free();
  return result;
}

beforeAll(async () => {
  const wasmPath = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm',
  );
  const wasmBuffer = readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(wasmBuffer).buffer });
  db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  // Must not throw — otherwise the app cannot start.
  migrate(db);
});

afterAll(() => {
  db?.close();
  db = null;
});

describe('migrate', () => {
  it('applies every migration without error', () => {
    const row = queryOne<{ max_version: number }>(
      'SELECT MAX(version) AS max_version FROM schema_migrations',
    );
    expect(row?.max_version).toBe(6);
  });

  it('creates the pages table', () => {
    const row = queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pages'",
    );
    expect(row?.name).toBe('pages');
  });

  it('does not rely on unsupported FTS5 objects', () => {
    const row = queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE name LIKE '%fts%'",
    );
    expect(row).toBeNull();
  });

  it('supports inserting and reading a page', () => {
    if (!db) throw new Error('db not initialized');
    db.run(
      `INSERT INTO pages (id, parent_id, title, content, icon, cover, position, created_at, updated_at, created_by)
       VALUES ('p1', NULL, 'Hello', 'World', '📄', NULL, 0, 1, 1, NULL)`,
    );
    const row = queryOne<{ title: string; position: number }>(
      "SELECT title, position FROM pages WHERE id = 'p1'",
    );
    expect(row?.title).toBe('Hello');
    expect(row?.position).toBe(0);
  });

  it('recovers when migration 5 was partially applied previously', () => {
    if (!db) throw new Error('db not initialized');
    // Simulate a database where the old FTS5 migration created the `pages`
    // table but crashed before recording version 5 (the user's exact state).
    db.run('DELETE FROM schema_migrations WHERE version = 5');

    expect(() => migrate(db as Database)).not.toThrow();

    const row = queryOne<{ max_version: number }>(
      'SELECT MAX(version) AS max_version FROM schema_migrations',
    );
    expect(row?.max_version).toBe(6);
  });
});
