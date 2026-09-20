/**
 * Migration Runner Tests
 *
 * Runs the REAL migration files against a fresh sql.js database. This guards
 * against migrations that are incompatible with the WASM SQLite build — e.g.
 * a `CREATE VIRTUAL TABLE ... USING fts5(...)` statement, which fails with
 * "no such module: fts5" and aborts application startup.
 * Also tests the post-migration v6 seeding logic (calendars table + source_id backfill).
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

function queryAll<T>(sql: string): T[] {
  if (!db) throw new Error('db not initialized');
  const stmt = db.prepare(sql);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

function runMigration(db: Database): Promise<void> {
  return migrate(db);
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
  await runMigration(db);
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

  it('creates the calendars table', () => {
    const row = queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'calendars'",
    );
    expect(row?.name).toBe('calendars');
  });

  it('creates source_id column on assignments', () => {
    const rows = queryAll<{ name: string }>(
      "PRAGMA table_info(assignments)",
    );
    const sourceIdCol = rows.find((r) => r.name === 'source_id');
    expect(sourceIdCol).toBeDefined();
  });

  it('creates idx_assignments_source_ical index', () => {
    const row = queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_assignments_source_ical'",
    );
    expect(row?.name).toBe('idx_assignments_source_ical');
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

    expect(() => runMigration(db as Database)).not.toThrow();

    const row = queryOne<{ max_version: number }>(
      'SELECT MAX(version) AS max_version FROM schema_migrations',
    );
    expect(row?.max_version).toBe(6);
  });
});

describe('migrate v6 seeding', () => {
  async function setupFreshDb(): Promise<Database> {
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
    const freshDb = new SQL.Database();
    freshDb.exec('PRAGMA foreign_keys = ON;');
    return freshDb;
  }

  async function insertLegacyIcalUrl(db: Database, url: string): Promise<void> {
    // Insert a plaintext icalUrl into settings (simulating pre-encryption state)
    // Note: In production this would be encrypted, but for testing we can use plaintext
    // to avoid needing the encryption key derivation to match
    db.run(
      "INSERT INTO settings (key, value) VALUES ('icalUrl', ?)",
      [JSON.stringify(url)],
    );
  }

  async function insertEncryptedIcalUrl(db: Database, url: string): Promise<void> {
    // We need to encrypt the URL using the same passphrase as the migration runner
    // The migration runner uses 'courseflow-v1' as passphrase
    const passphrase = 'courseflow-v1';
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const plaintext = encoder.encode(url);
    const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    const toBase64Url = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCodePoint(bytes[i] ?? 0);
      }
      return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    };

    const encrypted = {
      v: 1,
      ciphertext: toBase64Url(ciphertextBuffer),
      iv: toBase64Url(iv.buffer),
      salt: toBase64Url(salt.buffer),
    };

    db.run(
      "INSERT INTO settings (key, value) VALUES ('icalUrl', ?)",
      [JSON.stringify(encrypted)],
    );
  }

  function insertAssignment(db: Database, sourceUrl: string, icalUid: string): void {
    const now = Date.now();
    db.run(
      `INSERT INTO assignments (id, title, course_name, due_at, ical_uid, source, source_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ical', ?, 'pending', ?, ?)`,
      [crypto.randomUUID(), 'Test Assignment', 'Test Course', now + 86_400_000, icalUid, sourceUrl, now, now],
    );
  }

  function queryOneDb<T>(db: Database, sql: string): T | null {
    const stmt = db.prepare(sql);
    const result = stmt.step() ? (stmt.getAsObject() as T) : null;
    stmt.free();
    return result;
  }

  function queryAllDb<T>(db: Database, sql: string): T[] {
    const stmt = db.prepare(sql);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  it('seeds calendars table from encrypted settings.icalUrl on clean database', async () => {
    // Reset to fresh state by re-running migrations on a new DB
    const freshDb = await setupFreshDb();
    await migrate(freshDb); // Run migrations first to create tables
    await insertEncryptedIcalUrl(freshDb, 'https://calendar.google.com/calendar/ical/test%40gmail.com/private-xyz/basic.ics');
    await migrate(freshDb); // Run migrations again (seeding will happen)

    // Check calendars table was seeded
    const calRow = queryOneDb<{ name: string; feed_url: string }>(
      freshDb,
      "SELECT name, feed_url FROM calendars WHERE name = 'Primary Calendar'",
    );
    expect(calRow).toBeDefined();
    expect(calRow?.name).toBe('Primary Calendar');
    expect(calRow?.feed_url).toBeDefined();
    
    // The feed_url should be a JSON string of an EncryptedSetting
    const parsed = JSON.parse(calRow!.feed_url);
    expect(parsed.v).toBe(1);
    expect(parsed.ciphertext).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.salt).toBeDefined();

    freshDb.close();
  });

  it('backfills assignments.source_id when source_url matches', async () => {
    const freshDb = await setupFreshDb();
    const testUrl = 'https://calendar.google.com/calendar/ical/test%40gmail.com/private-xyz/basic.ics';
    await migrate(freshDb); // Run migrations first
    await insertEncryptedIcalUrl(freshDb, testUrl);
    
    // Insert an assignment with matching source_url
    insertAssignment(freshDb, testUrl, 'uid-123');
    
    await migrate(freshDb); // Run seeding

    // Check assignment was backfilled
    const assignRow = queryOneDb<{ source_id: string }>(
      freshDb,
      "SELECT source_id FROM assignments WHERE ical_uid = 'uid-123'",
    );
    expect(assignRow).toBeDefined();
    expect(assignRow?.source_id).toBeDefined();

    // Verify the source_id matches the calendar
    const calRow = queryOneDb<{ id: string }>(freshDb, "SELECT id FROM calendars WHERE name = 'Primary Calendar'");
    expect(assignRow?.source_id).toBe(calRow?.id);

    freshDb.close();
  });

  it('does not seed if calendars table already has rows', async () => {
    const freshDb = await setupFreshDb();
    await migrate(freshDb); // Run migrations first
    await insertEncryptedIcalUrl(freshDb, 'https://calendar.google.com/calendar/ical/test%40gmail.com/private-xyz/basic.ics');
    
    // Pre-seed the calendars table
    const now = Date.now();
    freshDb.run(
      `INSERT INTO calendars (id, name, feed_url, enabled, color, position, created_at, updated_at)
       VALUES ('pre-existing-cal', 'Existing Calendar', 'encrypted-data', 1, '#ff0000', 0, ?, ?)`,
      [now, now],
    );
    
    await migrate(freshDb); // Run seeding

    // Should still have only the pre-existing calendar
    const calRows = queryAllDb<{ name: string }>(freshDb, "SELECT name FROM calendars");
    expect(calRows.length).toBe(1);
    expect(calRows[0]?.name).toBe('Existing Calendar');

    freshDb.close();
  });

  it('does not seed if settings.icalUrl is not set', async () => {
    const freshDb = await setupFreshDb();
    await migrate(freshDb); // Run migrations first (no icalUrl in settings)
    await migrate(freshDb); // Run seeding

    // Calendars table should exist but be empty
    const calRows = queryAllDb<{ name: string }>(freshDb, "SELECT name FROM calendars");
    expect(calRows.length).toBe(0);

    freshDb.close();
  });

  it('does not seed if settings.icalUrl is empty', async () => {
    const freshDb = await setupFreshDb();
    await migrate(freshDb); // Run migrations first
    await insertLegacyIcalUrl(freshDb, '');
    await migrate(freshDb); // Run seeding

    // Calendars table should exist but be empty
    const calRows = queryAllDb<{ name: string }>(freshDb, "SELECT name FROM calendars");
    expect(calRows.length).toBe(0);

    freshDb.close();
  });

  it('backfills assignments with NULL source_url edge case', async () => {
    const freshDb = await setupFreshDb();
    const testUrl = 'https://calendar.google.com/calendar/ical/test%40gmail.com/private-xyz/basic.ics';
    await migrate(freshDb); // Run migrations first
    await insertEncryptedIcalUrl(freshDb, testUrl);
    
    // Insert an assignment with source='ical' but no source_url
    const now = Date.now();
    freshDb.run(
      `INSERT INTO assignments (id, title, course_name, due_at, ical_uid, source, source_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ical', NULL, 'pending', ?, ?)`,
      [crypto.randomUUID(), 'Test Assignment', 'Test Course', now + 86_400_000, 'uid-null-url', now, now],
    );
    
    await migrate(freshDb); // Run seeding

    // Check assignment was backfilled
    const assignRow = queryOneDb<{ source_id: string }>(
      freshDb,
      "SELECT source_id FROM assignments WHERE ical_uid = 'uid-null-url'",
    );
    expect(assignRow).toBeDefined();
    expect(assignRow?.source_id).toBeDefined();

    freshDb.close();
  });
});
