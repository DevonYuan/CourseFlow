/**
 * Database Migration Runner — Main Process
 *
 * Applies pending migrations sequentially on startup.
 * Tracks applied migrations in `schema_migrations` table.
 * Migrations are loaded from SQL files in `src/backend/main/db/migrations/`.
 * Includes post-migration v6 seeding: creates a CalendarSource from legacy
 * settings.icalUrl and backfills assignments.source_id.
 *
 * @module @backend/main/db/migrate
 */

import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from 'sql.js';

/**
 * Encrypted setting structure stored in the database.
 * All binary values are base64url-encoded strings.
 */
interface EncryptedSetting {
  v: 1;
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * Check if a parsed JSON value is an EncryptedSetting.
 */
function isEncryptedSetting(value: unknown): value is EncryptedSetting {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    (value as Record<string, unknown>)['v'] === 1 &&
    'ciphertext' in value &&
    'iv' in value &&
    'salt' in value
  );
}

/**
 * Convert ArrayBuffer to base64url string (no padding, URL-safe).
 */
function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCodePoint(byte);
    }
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * Convert base64url string to Uint8Array.
 */
function fromBase64Url(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes;
}

/**
 * Get the machine-specific passphrase for key derivation.
 * Matches the logic in src/backend/main/security/encryption.ts
 */
function getPassphrase(): string {
  // Use the same passphrase derivation as the encryption module
  // Note: In the migration runner we can't use `app.getPath('userData')` because
  // this module may run in test environments without Electron. We replicate the
  // logic using the known path structure.
  return 'courseflow-v1';
}

/**
 * Derive an AES-GCM key from passphrase and salt using PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext iCal URL for storage.
 */
async function encryptIcalUrl(url: string): Promise<EncryptedSetting> {
  try {
    const passphrase = getPassphrase();

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKey(passphrase, salt);

    const encoder = new TextEncoder();
    const plaintext = encoder.encode(url);
    const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    return {
      v: 1,
      ciphertext: toBase64Url(ciphertextBuffer),
      iv: toBase64Url(iv.buffer),
      salt: toBase64Url(salt.buffer),
    };
  } catch {
    throw new Error('Failed to encrypt iCal URL');
  }
}

/**
 * Decrypt an iCal URL from storage.
 */
async function decryptIcalUrl(encrypted: EncryptedSetting): Promise<string> {
  try {
    const passphrase = getPassphrase();

    const key = await deriveKey(passphrase, fromBase64Url(encrypted.salt));

    const ciphertext = fromBase64Url(encrypted.ciphertext);
    const iv = fromBase64Url(encrypted.iv);

    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch {
    throw new Error('Failed to decrypt iCal URL');
  }
}

/**
 * Deterministic color from a string (name).
 * Generates a consistent color for a given calendar name.
 */
function hashToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (name.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

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
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
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
 * After migrations, runs post-migration v6 seeding if applicable.
 *
 * @param db - sql.js Database instance to migrate
 * @throws {Error} If any migration fails
 */
export async function migrate(db: Database): Promise<void> {
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

  // Run post-migration seeding for v6 (calendars table + source_id backfill)
  // Only run if migration v6 was just applied or if calendars table is empty
  // and there's a legacy icalUrl to migrate
  const currentVersion = getCurrentVersion(db);
  if (currentVersion >= 6) {
    await runSeeding(db);
  }
}

/**
 * Run the post-migration v6 seeding logic.
 * This handles: creating a CalendarSource from legacy settings.icalUrl and
 * backfilling assignments.source_id by matching source_url.
 *
 * @param db - sql.js Database instance
 */
async function runSeeding(db: Database): Promise<void> {
  // Check if calendars table exists and has any rows
  const calendarCountStmt = db.prepare('SELECT COUNT(*) as count FROM calendars');
  const calendarCountRow = calendarCountStmt.step() ? calendarCountStmt.getAsObject() : null;
  calendarCountStmt.free();

  if (calendarCountRow && (calendarCountRow['count'] as number) > 0) {
    return; // Already seeded
  }

  // Get the legacy icalUrl from settings
  const icalUrlStmt = db.prepare("SELECT value FROM settings WHERE key = 'icalUrl'");
  const icalUrlRow = icalUrlStmt.step() ? icalUrlStmt.getAsObject() : null;
  icalUrlStmt.free();

  if (!icalUrlRow || !icalUrlRow['value']) {
    return; // No legacy URL to migrate
  }

  let legacyUrl: string;
  try {
    const parsed = JSON.parse(icalUrlRow['value'] as string);
    legacyUrl = isEncryptedSetting(parsed) ? (await decryptIcalUrl(parsed)) : parsed as string;
  } catch {
    return; // Invalid settings, skip seeding
  }

  if (!legacyUrl || legacyUrl.trim().length === 0) {
    return; // Empty URL, nothing to seed
  }

  // Create the calendar source
  const now = Date.now();
  const calendarId = randomUUID();
  const encrypted = await encryptIcalUrl(legacyUrl);
  const feedUrl = JSON.stringify(encrypted);
  const name = 'Primary Calendar';
  const color = hashToColor(name);

  const insertCalendarStmt = db.prepare(`
    INSERT INTO calendars (id, name, feed_url, enabled, color, position, last_sync_at, next_sync_at, last_error, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, 0, NULL, NULL, NULL, ?, ?)
  `);
  insertCalendarStmt.run([calendarId, name, feedUrl, color, now, now]);
  insertCalendarStmt.free();

  // Backfill assignments.source_id for ical assignments matching this feed URL
  const backfillStmt = db.prepare(`
    UPDATE assignments SET source_id = ? WHERE source = 'ical' AND source_url = ?
  `);
  backfillStmt.run([calendarId, legacyUrl]);
  backfillStmt.free();

  // Also update any assignments that have source='ical' but no source_url (edge case)
  const backfillNullStmt = db.prepare(`
    UPDATE assignments SET source_id = ? WHERE source = 'ical' AND source_id IS NULL AND source_url IS NULL
  `);
  backfillNullStmt.run([calendarId]);
  backfillNullStmt.free();
}

/**
 * Get the current schema version.
 *
 * @param db - sql.js Database instance
 * @returns Current schema version (0 if no migrations applied)
 */
export function getCurrentVersion(db: Database): number {
  const stmt = db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
  const row = stmt.step() ? (stmt.getAsObject() as { version: number }) : undefined;
  stmt.free();
  return row?.version ?? 0;
}
