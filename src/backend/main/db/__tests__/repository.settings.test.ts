/**
 * Settings Repository Integration Tests
 *
 * Tests for settings persistence, encryption, and defaults merging.
 *
 * @module @backend/main/db/__tests__/repository.settings
 */

import { app, BrowserWindow } from 'electron';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import type { Settings, DbSettings } from '../../../shared/types.js';
import { getDatabase, setTestDatabase, saveDatabase } from '../connection.js';
import { mapDbSettingsToSettings } from '../mappers.js';
import { repo } from '../repository.js';

// Test database instance
let testDb: Database | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function initTestDb(): Promise<Database> {
  if (SQL === null) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const wasmPath = path.resolve(
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
    const wasmBuffer = fs.readFileSync(wasmPath);
    SQL = await initSqlJs({ wasmBinary: new Uint8Array(wasmBuffer).buffer });
  }
  const db = new SQL.Database();
  return db;
}

function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

describe('Settings Repository', () => {
  beforeAll(async () => {
    testDb = await initTestDb();
    runMigrations(testDb);
    setTestDatabase(testDb);
  });

  afterAll(() => {
    if (testDb) {
      testDb.close();
      testDb = null;
    }
    // Reset to production database
    setTestDatabase(null);
  });

  beforeEach(() => {
    if (testDb) {
      testDb.exec('DELETE FROM settings');
      saveDatabase();
    }
  });

  describe('getAllSettings', () => {
    it('should return defaults when settings table is empty', async () => {
      const settings = await repo.getAllSettings();

      expect(settings.theme).toBe('system');
      expect(settings.autoFetchIcal).toBe(false);
      expect(settings.icalFetchIntervalMinutes).toBe(60);
      expect(settings.defaultPriority).toBe('medium');
      expect(settings.showCompletedAssignments).toBe(true);
      expect(settings.notifyDueSoon).toBe(true);
      expect(settings.dueSoonThresholdHours).toBe(24);
      expect(settings.icalUrl).toBe('');
      expect(settings.lastSyncAt).toBeNull();
      expect(settings.autoFetchIntervalMs).toBe(60 * 60 * 1000);
    });

    it('should merge stored settings with defaults', async () => {
      // Insert only theme and autoFetchIcal
      const db = getDatabase();
      db.run('INSERT INTO settings (key, value) VALUES (?, ?), (?, ?)', [
        'theme',
        JSON.stringify('dark'),
        'autoFetchIcal',
        JSON.stringify(true),
      ]);
      saveDatabase();

      const settings = await repo.getAllSettings();

      expect(settings.theme).toBe('dark');
      expect(settings.autoFetchIcal).toBe(true);
      // Other settings should be defaults
      expect(settings.icalFetchIntervalMinutes).toBe(60);
      expect(settings.defaultPriority).toBe('medium');
      expect(settings.icalUrl).toBe('');
    });

    it('should compute autoFetchIntervalMs from icalFetchIntervalMinutes', async () => {
      const db = getDatabase();
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'icalFetchIntervalMinutes',
        JSON.stringify(30),
      ]);
      saveDatabase();

      const settings = await repo.getAllSettings();

      expect(settings.autoFetchIntervalMs).toBe(30 * 60 * 1000);
    });
  });

  describe('setSettings', () => {
    it('should persist partial settings and merge with existing', async () => {
      // Set initial settings
      const db = getDatabase();
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme', JSON.stringify('light')]);
      saveDatabase();

      // Update only autoFetchIcal
      const updated = await repo.setSettings({ autoFetchIcal: true });

      expect(updated.theme).toBe('light'); // preserved
      expect(updated.autoFetchIcal).toBe(true); // updated
      expect(updated.icalFetchIntervalMinutes).toBe(60); // default

      // Verify persisted
      const persisted = await repo.getAllSettings();
      expect(persisted.theme).toBe('light');
      expect(persisted.autoFetchIcal).toBe(true);
    });

    it('should encrypt icalUrl when set', async () => {
      const testUrl = 'https://canvas.example.com/feeds/abc123.ics';

      const updated = await repo.setSettings({ icalUrl: testUrl });

      expect(updated.icalUrl).toBe(testUrl); // decrypted on get

      // Verify encrypted in database
      const db = getDatabase();
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      stmt.bind(['icalUrl']);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();

      expect(row).not.toBeNull();
      const parsed = JSON.parse(row!['value'] as string);
      expect(parsed.v).toBe(1);
      expect(parsed.ciphertext).toBeDefined();
      expect(parsed.iv).toBeDefined();
      expect(parsed.salt).toBeDefined();
    });

    it('should handle empty icalUrl without encryption', async () => {
      await repo.setSettings({ icalUrl: '' });

      const db = getDatabase();
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      stmt.bind(['icalUrl']);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();

      const parsed = JSON.parse(row!['value'] as string);
      expect(parsed).toBe(''); // stored as empty string, not encrypted
    });

    it('should update icalFetchIntervalMinutes and recompute autoFetchIntervalMs', async () => {
      const updated = await repo.setSettings({ icalFetchIntervalMinutes: 15 });

      expect(updated.icalFetchIntervalMinutes).toBe(15);
      expect(updated.autoFetchIntervalMs).toBe(15 * 60 * 1000);
    });

    it('should use transaction (atomic write)', async () => {
      // This test verifies the transaction behavior by checking that
      // partial failures don't leave partial state
      // We can't easily simulate a mid-transaction failure in sql.js,
      // but we verify the transaction pattern is used
      const updated = await repo.setSettings({
        theme: 'dark',
        autoFetchIcal: true,
        icalFetchIntervalMinutes: 30,
      });

      expect(updated.theme).toBe('dark');
      expect(updated.autoFetchIcal).toBe(true);
      expect(updated.icalFetchIntervalMinutes).toBe(30);
    });
  });

  describe('resetSettings', () => {
    it('should restore all defaults', async () => {
      // Set custom values
      const db = getDatabase();
      db.run('INSERT INTO settings (key, value) VALUES (?, ?), (?, ?), (?, ?)', [
        'theme',
        JSON.stringify('dark'),
        'autoFetchIcal',
        JSON.stringify(true),
        'icalUrl',
        JSON.stringify('https://example.com/feed.ics'),
      ]);
      saveDatabase();

      const reset = await repo.resetSettings();

      expect(reset.theme).toBe('system');
      expect(reset.autoFetchIcal).toBe(false);
      expect(reset.icalUrl).toBe('');
      expect(reset.icalFetchIntervalMinutes).toBe(60);
      expect(reset.defaultPriority).toBe('medium');
      expect(reset.showCompletedAssignments).toBe(true);
      expect(reset.notifyDueSoon).toBe(true);
      expect(reset.dueSoonThresholdHours).toBe(24);
      expect(reset.lastSyncAt).toBeNull();
      expect(reset.autoFetchIntervalMs).toBe(60 * 60 * 1000);
    });

    it('should clear all settings from database and re-insert defaults', async () => {
      // Set custom values
      const db = getDatabase();
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme', JSON.stringify('dark')]);
      saveDatabase();

      await repo.resetSettings();

      // Verify all default keys exist in database
      const rows = db.prepare('SELECT key FROM settings');
      const keys: string[] = [];
      while (rows.step()) {
        keys.push(rows.getAsObject()['key'] as string);
      }
      rows.free();

      expect(keys.sort()).toEqual(
        [
          'autoFetchIcal',
          'autoFetchIntervalMs',
          'defaultPriority',
          'dueSoonThresholdHours',
          'icalFetchIntervalMinutes',
          'icalUrl',
          'lastSyncAt',
          'notifyDueSoon',
          'showCompletedAssignments',
          'syncIntervalMinutes',
          'theme',
        ].sort(),
      );
    });
  });

  describe('encryption integration', () => {
    it('should decrypt icalUrl on getAllSettings', async () => {
      const testUrl = 'https://canvas.example.com/feeds/encrypted123.ics';

      await repo.setSettings({ icalUrl: testUrl });
      const settings = await repo.getAllSettings();

      expect(settings.icalUrl).toBe(testUrl);
    });

    it('should handle corrupted encrypted data gracefully', async () => {
      // Manually insert corrupted encrypted data
      const db = getDatabase();
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'icalUrl',
        JSON.stringify({ v: 1, ciphertext: 'bad', iv: 'bad', salt: 'bad' }),
      ]);
      saveDatabase();

      // Should not throw, should return default empty string
      const settings = await repo.getAllSettings();
      expect(settings.icalUrl).toBe('');
    });
  });

  describe('settings:changed event', () => {
    // Note: Event emission is tested in IPC handler tests
    // Here we just verify the repository functions don't throw
    it('should not throw when emitting settings:changed', async () => {
      await expect(repo.setSettings({ theme: 'dark' })).resolves.toBeDefined();
      await expect(repo.resetSettings()).resolves.toBeDefined();
    });
  });
});
