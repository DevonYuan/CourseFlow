/**
 * CalendarSource Repository Tests
 *
 * Covers CRUD operations for calendar sources including encryption,
 * position management, soft-delete, and reordering.
 *
 * @module @backend/main/db/__tests__/repository.calendars
 */

import { app } from 'electron';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron app.getPath for encryption
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

// Import after mocking electron
import { repo } from '../repository.js';

// The repository reads the database and emits events through these modules.
// Inject a test database and a spy so the real repository logic runs in isolation.
const mockState = vi.hoisted(() => ({
  db: null as unknown,
  sendEventToRenderers: vi.fn(),
}));

vi.mock('../connection.js', () => ({
  getDatabase: () => mockState.db,
  saveDatabase: () => {},
}));

vi.mock('../../events.js', () => ({
  sendEventToRenderers: mockState.sendEventToRenderers,
}));

let testDb: Database | null = null;

async function initTestDb(): Promise<Database> {
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
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(wasmBuffer).buffer });
  return new SQL.Database();
}

function createSchema(db: Database): void {
  db.exec(`
    CREATE TABLE calendars (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      color TEXT NOT NULL,
      position INTEGER NOT NULL,
      last_sync_at INTEGER,
      next_sync_at INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

beforeAll(async () => {
  testDb = await initTestDb();
  createSchema(testDb);
});

beforeEach(() => {
  testDb!.exec('DELETE FROM calendars');
  mockState.db = testDb;
  mockState.sendEventToRenderers.mockClear();
});

afterAll(() => {
  testDb?.close();
  testDb = null;
});

describe('CalendarSource Repository', () => {
  describe('createCalendar', () => {
    it('creates a calendar with encrypted feed URL and emits insert event', async () => {
      const input = {
        name: 'Test Calendar',
        feedUrl: 'https://example.com/calendar.ics',
        enabled: true,
        color: '#ff0000',
      };

      const calendar = await repo.createCalendar(input);

      expect(calendar.id).toBeDefined();
      expect(calendar.name).toBe('Test Calendar');
      expect(calendar.feedUrl).not.toBe('https://example.com/calendar.ics'); // Should be encrypted
      expect(calendar.enabled).toBe(true);
      expect(calendar.color).toBe('#ff0000');
      expect(calendar.position).toBe(0);
      expect(calendar.lastSyncAt).toBeNull();
      expect(calendar.nextSyncAt).toBeNull();
      expect(calendar.lastError).toBeNull();
      expect(calendar.createdAt).toBeDefined();
      expect(calendar.updatedAt).toBeDefined();

      // Verify event was emitted
      expect(mockState.sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'insert',
        id: calendar.id,
      });
    });

    it('assigns position automatically (appends to end)', async () => {
      await repo.createCalendar({ name: 'Cal 1', feedUrl: 'https://a.com/cal.ics' });
      await repo.createCalendar({ name: 'Cal 2', feedUrl: 'https://b.com/cal.ics' });
      const cal3 = await repo.createCalendar({ name: 'Cal 3', feedUrl: 'https://c.com/cal.ics' });

      expect(cal3.position).toBe(2);
    });

    it('generates deterministic color from name when not provided', async () => {
      const cal1 = await repo.createCalendar({ name: 'School', feedUrl: 'https://a.com/cal.ics' });
      const cal2 = await repo.createCalendar({ name: 'School', feedUrl: 'https://b.com/cal.ics' });

      // Same name should produce same color
      expect(cal1.color).toBe(cal2.color);
    });

    it('encrypts feed URL (different ciphertext each time)', async () => {
      const cal1 = await repo.createCalendar({ name: 'Cal 1', feedUrl: 'https://same.com/cal.ics' });
      const cal2 = await repo.createCalendar({ name: 'Cal 2', feedUrl: 'https://same.com/cal.ics' });

      // Same URL but different encryption (random IV/salt)
      expect(cal1.feedUrl).not.toBe(cal2.feedUrl);
    });

    it('uses provided position when specified', async () => {
      const cal = await repo.createCalendar({
        name: 'Cal',
        feedUrl: 'https://example.com/cal.ics',
        position: 5,
      });

      expect(cal.position).toBe(5);
    });
  });

  describe('listCalendars', () => {
    it('returns calendars ordered by position', async () => {
      await repo.createCalendar({ name: 'Third', feedUrl: 'https://c.com/cal.ics', position: 2 });
      await repo.createCalendar({ name: 'First', feedUrl: 'https://a.com/cal.ics', position: 0 });
      await repo.createCalendar({ name: 'Second', feedUrl: 'https://b.com/cal.ics', position: 1 });

      const calendars = repo.listCalendars();

      expect(calendars.length).toBe(3);
      expect(calendars[0]!.name).toBe('First');
      expect(calendars[1]!.name).toBe('Second');
      expect(calendars[2]!.name).toBe('Third');
    });

    it('returns empty array when no calendars exist', () => {
      const calendars = repo.listCalendars();
      expect(calendars).toEqual([]);
    });
  });

  describe('getCalendar', () => {
    it('returns calendar by ID', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics' });
      const found = repo.getCalendar(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Test');
    });

    it('returns null for non-existent ID', () => {
      const found = repo.getCalendar('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('updateCalendar', () => {
    it('updates name and emits update event', async () => {
      const created = await repo.createCalendar({ name: 'Original', feedUrl: 'https://example.com/cal.ics' });
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendar(created.id, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.id).toBe(created.id);
      expect(updated.updatedAt).not.toBe(created.updatedAt);

      expect(mockState.sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'update',
        id: created.id,
      });
    });

    it('re-encrypts feed URL when changed', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://original.com/cal.ics' });
      const oldFeedUrl = created.feedUrl;
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendar(created.id, { feedUrl: 'https://new.com/cal.ics' });

      expect(updated.feedUrl).not.toBe(oldFeedUrl);
      expect(updated.feedUrl).not.toBe('https://new.com/cal.ics'); // Should be encrypted
    });

    it('preserves feed URL when not provided in update', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics' });
      const oldFeedUrl = created.feedUrl;
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendar(created.id, { name: 'New Name' });

      expect(updated.feedUrl).toBe(oldFeedUrl);
    });

    it('updates enabled state', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics', enabled: true });
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendar(created.id, { enabled: false });

      expect(updated.enabled).toBe(false);
    });

    it('updates color', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics', color: '#ff0000' });
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendar(created.id, { color: '#00ff00' });

      expect(updated.color).toBe('#00ff00');
    });

    it('updates position', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics', position: 0 });
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendar(created.id, { position: 10 });

      expect(updated.position).toBe(10);
    });

    it('throws error for non-existent ID', async () => {
      await expect(repo.updateCalendar('non-existent', { name: 'Test' })).rejects.toThrow('Calendar not found');
    });
  });

  describe('deleteCalendar (soft delete)', () => {
    it('sets enabled=0 and emits update event', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics', enabled: true });
      mockState.sendEventToRenderers.mockClear();

      await repo.deleteCalendar(created.id);

      const found = repo.getCalendar(created.id);
      expect(found).not.toBeNull();
      expect(found!.enabled).toBe(false);

      expect(mockState.sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'update',
        id: created.id,
      });
    });

    it('preserves calendar data (not hard deleted)', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics', color: '#ff0000' });
      await repo.deleteCalendar(created.id);

      const found = repo.getCalendar(created.id);
      expect(found!.name).toBe('Test');
      expect(found!.color).toBe('#ff0000');
      expect(found!.feedUrl).toBe(created.feedUrl);
    });
  });

  describe('reorderCalendars', () => {
    it('reorders calendars using negative offset technique', async () => {
      const cal1 = await repo.createCalendar({ name: 'Cal 1', feedUrl: 'https://a.com/cal.ics', position: 0 });
      const cal2 = await repo.createCalendar({ name: 'Cal 2', feedUrl: 'https://b.com/cal.ics', position: 1 });
      const cal3 = await repo.createCalendar({ name: 'Cal 3', feedUrl: 'https://c.com/cal.ics', position: 2 });
      mockState.sendEventToRenderers.mockClear();

      // Move cal3 to position 0, cal1 to position 1, cal2 to position 2
      repo.reorderCalendars([cal3.id, cal1.id, cal2.id]);

      const calendars = repo.listCalendars();
      expect(calendars[0]!.id).toBe(cal3.id);
      expect(calendars[0]!.position).toBe(0);
      expect(calendars[1]!.id).toBe(cal1.id);
      expect(calendars[1]!.position).toBe(1);
      expect(calendars[2]!.id).toBe(cal2.id);
      expect(calendars[2]!.position).toBe(2);

      expect(mockState.sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'reorder',
        id: `${cal3.id},${cal1.id},${cal2.id}`,
      });
    });

    it('handles move to top', async () => {
      const cal1 = await repo.createCalendar({ name: 'Cal 1', feedUrl: 'https://a.com/cal.ics', position: 0 });
      const cal2 = await repo.createCalendar({ name: 'Cal 2', feedUrl: 'https://b.com/cal.ics', position: 1 });
      const cal3 = await repo.createCalendar({ name: 'Cal 3', feedUrl: 'https://c.com/cal.ics', position: 2 });

      repo.reorderCalendars([cal3.id, cal1.id, cal2.id]);

      const calendars = repo.listCalendars();
      expect(calendars[0]!.id).toBe(cal3.id);
    });

    it('handles move to bottom', async () => {
      const cal1 = await repo.createCalendar({ name: 'Cal 1', feedUrl: 'https://a.com/cal.ics', position: 0 });
      const cal2 = await repo.createCalendar({ name: 'Cal 2', feedUrl: 'https://b.com/cal.ics', position: 1 });
      const cal3 = await repo.createCalendar({ name: 'Cal 3', feedUrl: 'https://c.com/cal.ics', position: 2 });

      repo.reorderCalendars([cal2.id, cal3.id, cal1.id]);

      const calendars = repo.listCalendars();
      expect(calendars[2]!.id).toBe(cal1.id);
    });

    it('handles single calendar', async () => {
      const cal1 = await repo.createCalendar({ name: 'Cal 1', feedUrl: 'https://a.com/cal.ics', position: 0 });

      repo.reorderCalendars([cal1.id]);

      const calendars = repo.listCalendars();
      expect(calendars[0]!.id).toBe(cal1.id);
      expect(calendars[0]!.position).toBe(0);
    });
  });

  describe('setCalendarEnabled', () => {
    it('enables a disabled calendar', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics', enabled: false });
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.setCalendarEnabled(created.id, true);

      expect(updated.enabled).toBe(true);
      expect(mockState.sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'update',
        id: created.id,
      });
    });

    it('disables an enabled calendar', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics', enabled: true });
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.setCalendarEnabled(created.id, false);

      expect(updated.enabled).toBe(false);
    });

    it('throws error for non-existent ID', async () => {
      await expect(repo.setCalendarEnabled('non-existent', true)).rejects.toThrow('Calendar not found');
    });
  });

  describe('updateCalendarSyncTime', () => {
    it('updates last_sync_at and calculates next_sync_at', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics' });
      mockState.sendEventToRenderers.mockClear();

      const lastSyncAt = Date.now();
      const intervalMinutes = 15;
      const updated = await repo.updateCalendarSyncTime(created.id, lastSyncAt, intervalMinutes);

      expect(updated.lastSyncAt).toBeDefined();
      expect(new Date(updated.lastSyncAt!).getTime()).toBe(lastSyncAt);
      expect(updated.nextSyncAt).toBeDefined();
      expect(new Date(updated.nextSyncAt!).getTime()).toBe(lastSyncAt + intervalMinutes * 60 * 1000);
    });
  });

  describe('updateCalendarError', () => {
    it('sets last_error and emits update event', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics' });
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendarError(created.id, 'Network error');

      expect(updated.lastError).toBe('Network error');
      expect(mockState.sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'update',
        id: created.id,
      });
    });

    it('clears last_error when null is provided', async () => {
      const created = await repo.createCalendar({ name: 'Test', feedUrl: 'https://example.com/cal.ics' });
      await repo.updateCalendarError(created.id, 'Previous error');
      mockState.sendEventToRenderers.mockClear();

      const updated = await repo.updateCalendarError(created.id, null);

      expect(updated.lastError).toBeNull();
    });
  });
});