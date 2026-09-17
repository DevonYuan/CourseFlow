/**
 * Integration tests for Calendar IPC handlers.
 *
 * Verifies the 7 Phase 4 calendar channels:
 * - db:calendars:list / get / create / update / delete / reorder / setEnabled
 *
 * Each handler must return a typed IpcResult and emit the correct `db:changed`
 * event on mutations.
 *
 * @module @backend/main/__tests__/ipc.calendars
 */

import { ipcMain } from 'electron';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

// Mock the ical utilities (imported by ipc-handlers, not exercised here)
vi.mock('../ical/index.js', () => ({
  fetchICalFeed: vi.fn(),
  parseICalFeed: vi.fn(),
  mapICalToAssignments: vi.fn(),
  NetworkError: class NetworkError extends Error {},
  HttpError: class HttpError extends Error {},
  TimeoutError: class TimeoutError extends Error {},
  ICalParseError: class ICalParseError extends Error {},
}));

// Mock the repository
vi.mock('../db/repository.js', () => ({
  repo: {
    listCalendars: vi.fn(),
    getCalendar: vi.fn(),
    createCalendar: vi.fn(),
    updateCalendar: vi.fn(),
    deleteCalendar: vi.fn(),
    reorderCalendars: vi.fn(),
    setCalendarEnabled: vi.fn(),
  },
}));

// Mock events
vi.mock('../events.js', () => ({
  sendEventToRenderers: vi.fn(),
}));

// Import mocked modules
import type { IpcResult } from '../../shared/ipc.js';
import type { CalendarSource, CalendarSourceInput, CalendarSourceUpdateInput } from '../../shared/types.js';
import { repo } from '../db/repository.js';
import { sendEventToRenderers } from '../events.js';
import { registerIpcHandlers } from '../ipc-handlers.js';

function makeCalendar(overrides: Partial<CalendarSource> = {}): CalendarSource {
  return {
    id: 'cal-1' as CalendarSource['id'],
    name: 'Test Calendar',
    feedUrl: 'encrypted-url',
    enabled: true,
    color: '#3b82f6',
    position: 0,
    lastSyncAt: null,
    nextSyncAt: null,
    lastError: null,
    createdAt: '2025-01-01T00:00:00.000Z' as CalendarSource['createdAt'],
    updatedAt: '2025-01-01T00:00:00.000Z' as CalendarSource['updatedAt'],
    ...overrides,
  };
}

function asEntityId(id: string): CalendarSource['id'] {
  return id as CalendarSource['id'];
}

type IpcHandler = (event: unknown, request: unknown) => unknown;

describe('Calendar IPC Handlers', () => {
  let registeredHandlers: Map<string, IpcHandler>;

  beforeEach(async () => {
    vi.resetAllMocks();

    registeredHandlers = new Map();
    const handleMock = vi.mocked(ipcMain.handle);
    handleMock.mockImplementation((channel: string, handler: unknown) => {
      registeredHandlers.set(channel, handler as IpcHandler);
    });

    // Import the module to register handlers
    await import('../ipc-handlers.js');
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const invoke = async <T>(channel: string, request: unknown): Promise<IpcResult<T>> => {
    const handler = registeredHandlers.get(channel);
    if (!handler) {
      throw new Error(`Handler for channel ${channel} not registered`);
    }
    return handler(null, request) as Promise<IpcResult<T>>;
  };

  // ── db:calendars:list ──────────────────────────────────────────────────

  describe('db:calendars:list', () => {
    it('returns all calendars', async () => {
      const calendars = [makeCalendar(), makeCalendar({ id: 'cal-2' as CalendarSource['id'], name: 'Calendar 2' })];
      vi.mocked(repo.listCalendars).mockReturnValue(calendars);

      const result = await invoke<CalendarSource[]>('db:calendars:list', undefined);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(calendars);
      expect(repo.listCalendars).toHaveBeenCalledWith();
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.listCalendars).mockImplementation(() => {
        throw new Error('boom');
      });

      const result = await invoke<CalendarSource[]>('db:calendars:list', undefined);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('boom');
    });

    it('returns empty array when no calendars exist', async () => {
      vi.mocked(repo.listCalendars).mockReturnValue([]);

      const result = await invoke<CalendarSource[]>('db:calendars:list', undefined);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual([]);
    });
  });

  // ── db:calendars:get ──────────────────────────────────────────────────

  describe('db:calendars:get', () => {
    it('returns the calendar for a valid ID', async () => {
      const calendar = makeCalendar();
      vi.mocked(repo.getCalendar).mockReturnValue(calendar);

      const result = await invoke<CalendarSource | null>('db:calendars:get', 'cal-1');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(calendar);
      expect(repo.getCalendar).toHaveBeenCalledWith('cal-1');
    });

    it('returns NOT_FOUND for non-existent ID', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(null);

      const result = await invoke<CalendarSource | null>('db:calendars:get', 'missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NOT_FOUND');
        expect(result.error).toBe('Calendar not found');
      }
      expect(repo.getCalendar).toHaveBeenCalledWith('missing');
    });

    it('returns VALIDATION_ERROR for empty ID', async () => {
      const result = await invoke<CalendarSource | null>('db:calendars:get', '');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('id is required');
      }
    });

    it('returns VALIDATION_ERROR for non-string ID', async () => {
      const result = await invoke<CalendarSource | null>('db:calendars:get', 123 as unknown);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.getCalendar).mockImplementation(() => {
        throw new Error('db down');
      });

      const result = await invoke<CalendarSource | null>('db:calendars:get', 'cal-1');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('db down');
    });
  });

  // ── db:calendars:create ───────────────────────────────────────────────

  describe('db:calendars:create', () => {
    const validInput: CalendarSourceInput = {
      name: 'New Calendar',
      feedUrl: 'https://example.com/calendar.ics',
      enabled: true,
      color: '#ff0000',
      position: 0,
    };

    it('creates a calendar and emits an insert event', async () => {
      const created = makeCalendar({ name: 'New Calendar', color: '#ff0000' });
      vi.mocked(repo.createCalendar).mockResolvedValue(created);

      const result = await invoke<CalendarSource>('db:calendars:create', validInput);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(created);
      expect(repo.createCalendar).toHaveBeenCalledWith(validInput);
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'insert',
        id: 'cal-1',
      });
    });

    it('returns VALIDATION_ERROR when name is missing', async () => {
      const input = { ...validInput, name: '' };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('name is required');
      }
      expect(repo.createCalendar).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR when name is whitespace only', async () => {
      const input = { ...validInput, name: '   ' };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('name is required');
      }
    });

    it('returns VALIDATION_ERROR when feedUrl is missing', async () => {
      const input = { ...validInput, feedUrl: '' };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('feedUrl is required');
      }
    });

    it('returns VALIDATION_ERROR when feedUrl is invalid URL', async () => {
      const input = { ...validInput, feedUrl: 'not-a-url' };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('Invalid feedUrl format');
      }
    });

    it('returns VALIDATION_ERROR when color is invalid hex format', async () => {
      const input = { ...validInput, color: 'red' };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('valid hex color');
      }
    });

    it('returns VALIDATION_ERROR when color is invalid hex (short)', async () => {
      const input = { ...validInput, color: '#fff' };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('valid hex color');
      }
    });

    it('returns VALIDATION_ERROR when color is invalid hex (no hash)', async () => {
      const input = { ...validInput, color: 'ff0000' };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('valid hex color');
      }
    });

    it('accepts valid hex color formats', async () => {
      const created = makeCalendar();
      vi.mocked(repo.createCalendar).mockResolvedValue(created);

      for (const color of ['#3b82f6', '#FF0000', '#abcdef', '#ABCDEF', '#000000', '#ffffff']) {
        vi.mocked(repo.createCalendar).mockClear();
        const input = { ...validInput, color };
        const result = await invoke<CalendarSource>('db:calendars:create', input);
        expect(result.ok).toBe(true);
      }
    });

    it('returns VALIDATION_ERROR when position is negative', async () => {
      const input = { ...validInput, position: -1 };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('position must be a non-negative integer');
      }
    });

    it('returns VALIDATION_ERROR when position is not an integer', async () => {
      const input = { ...validInput, position: 1.5 };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('position must be a non-negative integer');
      }
    });

    it('returns VALIDATION_ERROR when enabled is not a boolean', async () => {
      const input = { ...validInput, enabled: 'true' as unknown };
      const result = await invoke<CalendarSource>('db:calendars:create', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('enabled must be a boolean');
      }
    });

    it('returns VALIDATION_ERROR for invalid input object', async () => {
      const result = await invoke<CalendarSource>('db:calendars:create', 'not-an-object');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('expected CalendarSourceInput object');
      }
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.createCalendar).mockRejectedValue(new Error('insert failed'));

      const result = await invoke<CalendarSource>('db:calendars:create', validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('insert failed');
      expect(sendEventToRenderers).not.toHaveBeenCalled();
    });
  });

  // ── db:calendars:update ───────────────────────────────────────────────

  describe('db:calendars:update', () => {
    const validUpdateInput: CalendarSourceUpdateInput = {
      id: asEntityId('cal-1'),
      name: 'Updated Calendar',
      feedUrl: 'https://updated.com/calendar.ics',
      enabled: false,
      color: '#00ff00',
      position: 5,
    };

    it('updates a calendar and emits an update event', async () => {
      const updated = makeCalendar({ name: 'Updated Calendar', color: '#00ff00', enabled: false, position: 5 });
      vi.mocked(repo.updateCalendar).mockResolvedValue(updated);
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar()); // for NOT_FOUND check

      const result = await invoke<CalendarSource>('db:calendars:update', validUpdateInput);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(updated);
      expect(repo.updateCalendar).toHaveBeenCalledWith(validUpdateInput);
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'update',
        id: 'cal-1',
      });
    });

    it('returns NOT_FOUND when calendar does not exist', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(null);

      const result = await invoke<CalendarSource>('db:calendars:update', validUpdateInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NOT_FOUND');
        expect(result.error).toBe('Calendar not found');
      }
      expect(repo.updateCalendar).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR when id is missing', async () => {
      const input = { ...validUpdateInput, id: '' };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('id is required');
      }
    });

    it('returns VALIDATION_ERROR when name is empty string', async () => {
      const input = { ...validUpdateInput, name: '' };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('name must be a non-empty string');
      }
    });

    it('returns VALIDATION_ERROR when feedUrl is invalid URL', async () => {
      const input = { ...validUpdateInput, feedUrl: 'not-a-url' };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('Invalid feedUrl format');
      }
    });

    it('returns VALIDATION_ERROR when color is invalid hex format', async () => {
      const input = { ...validUpdateInput, color: 'blue' };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('valid hex color');
      }
    });

    it('allows partial updates (only name)', async () => {
      const updated = makeCalendar({ name: 'Only Name Updated' });
      vi.mocked(repo.updateCalendar).mockResolvedValue(updated);
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());

      const input: CalendarSourceUpdateInput = { id: asEntityId('cal-1'), name: 'Only Name Updated' };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(true);
      expect(repo.updateCalendar).toHaveBeenCalledWith(input);
    });

    it('allows partial updates (only feedUrl)', async () => {
      const updated = makeCalendar({ feedUrl: 'new-encrypted' });
      vi.mocked(repo.updateCalendar).mockResolvedValue(updated);
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());

      const input: CalendarSourceUpdateInput = { id: asEntityId('cal-1'), feedUrl: 'https://new.com/cal.ics' };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(true);
    });

    it('allows partial updates (only enabled)', async () => {
      const updated = makeCalendar({ enabled: false });
      vi.mocked(repo.updateCalendar).mockResolvedValue(updated);
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());

      const input: CalendarSourceUpdateInput = { id: asEntityId('cal-1'), enabled: false };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(true);
    });

    it('returns VALIDATION_ERROR when enabled is not a boolean', async () => {
      const input = { ...validUpdateInput, enabled: 'false' as unknown };
      const result = await invoke<CalendarSource>('db:calendars:update', input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('enabled must be a boolean');
      }
    });

    it('returns VALIDATION_ERROR for invalid input object', async () => {
      const result = await invoke<CalendarSource>('db:calendars:update', 'not-an-object');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('expected CalendarSourceUpdateInput object');
      }
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());
      vi.mocked(repo.updateCalendar).mockRejectedValue(new Error('update failed'));

      const result = await invoke<CalendarSource>('db:calendars:update', validUpdateInput);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('update failed');
      expect(sendEventToRenderers).not.toHaveBeenCalled();
    });

    });

  // ── db:calendars:delete ───────────────────────────────────────────────

  describe('db:calendars:delete', () => {
    it('deletes a calendar and emits a delete event', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());

      const result = await invoke<void>('db:calendars:delete', 'cal-1');

      expect(result.ok).toBe(true);
      expect(repo.getCalendar).toHaveBeenCalledWith('cal-1');
      expect(repo.deleteCalendar).toHaveBeenCalledWith('cal-1');
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'delete',
        id: 'cal-1',
      });
    });

    it('returns NOT_FOUND when calendar does not exist', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(null);

      const result = await invoke<void>('db:calendars:delete', 'missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NOT_FOUND');
        expect(result.error).toBe('Calendar not found');
      }
      expect(repo.deleteCalendar).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR for empty ID', async () => {
      const result = await invoke<void>('db:calendars:delete', '');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('id is required');
      }
    });

    it('returns VALIDATION_ERROR for non-string ID', async () => {
      const result = await invoke<void>('db:calendars:delete', 123 as unknown);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());
      vi.mocked(repo.deleteCalendar).mockImplementation(() => {
        throw new Error('delete failed');
      });

      const result = await invoke<void>('db:calendars:delete', 'cal-1');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('delete failed');
      expect(sendEventToRenderers).not.toHaveBeenCalled();
    });
  });

  // ── db:calendars:reorder ──────────────────────────────────────────────

  describe('db:calendars:reorder', () => {
    it('reorders calendars and emits a single reorder event with id=all', async () => {
      const cal1 = makeCalendar({ id: 'cal-1' as CalendarSource['id'] });
      const cal2 = makeCalendar({ id: 'cal-2' as CalendarSource['id'] });
      const cal3 = makeCalendar({ id: 'cal-3' as CalendarSource['id'] });
      vi.mocked(repo.getCalendar)
        .mockReturnValueOnce(cal1)
        .mockReturnValueOnce(cal2)
        .mockReturnValueOnce(cal3);

      const result = await invoke<void>('db:calendars:reorder', ['cal-3', 'cal-1', 'cal-2']);

      expect(result.ok).toBe(true);
      expect(repo.reorderCalendars).toHaveBeenCalledWith(['cal-3', 'cal-1', 'cal-2']);
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'reorder',
        id: 'all',
      });
    });

    it('returns NOT_FOUND when any calendar does not exist', async () => {
      vi.mocked(repo.getCalendar)
        .mockReturnValueOnce(makeCalendar({ id: 'cal-1' as CalendarSource['id'] }))
        .mockReturnValueOnce(null);

      const result = await invoke<void>('db:calendars:reorder', ['cal-1', 'missing']);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NOT_FOUND');
        expect(result.error).toContain('Calendar not found: missing');
      }
      expect(repo.reorderCalendars).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR for empty array', async () => {
      const result = await invoke<void>('db:calendars:reorder', []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('Expected non-empty array');
      }
    });

    it('returns VALIDATION_ERROR for non-array input', async () => {
      const result = await invoke<void>('db:calendars:reorder', 'not-an-array' as unknown);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('Expected non-empty array');
      }
    });

    it('returns VALIDATION_ERROR when array contains empty string', async () => {
      const result = await invoke<void>('db:calendars:reorder', ['cal-1', '']);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('All calendar IDs must be non-empty strings');
      }
    });

    it('returns VALIDATION_ERROR when array contains non-string', async () => {
      const result = await invoke<void>('db:calendars:reorder', ['cal-1', 123 as unknown]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('All calendar IDs must be non-empty strings');
      }
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());
      vi.mocked(repo.reorderCalendars).mockImplementation(() => {
        throw new Error('reorder failed');
      });

      const result = await invoke<void>('db:calendars:reorder', ['cal-1', 'cal-2']);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INTERNAL_ERROR');
        expect(result.error).toContain('reorder failed');
      }
    });
  });

  // ── db:calendars:setEnabled ───────────────────────────────────────────

  describe('db:calendars:setEnabled', () => {
    it('sets enabled state and emits an update event', async () => {
      const updated = makeCalendar({ enabled: false });
      vi.mocked(repo.setCalendarEnabled).mockResolvedValue(updated);
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());

      const result = await invoke<CalendarSource>('db:calendars:setEnabled', {
        id: 'cal-1',
        enabled: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.enabled).toBe(false);
      expect(repo.getCalendar).toHaveBeenCalledWith('cal-1');
      expect(repo.setCalendarEnabled).toHaveBeenCalledWith('cal-1', false);
      expect(sendEventToRenderers).toHaveBeenCalledWith('db:changed', {
        table: 'calendars',
        action: 'update',
        id: 'cal-1',
      });
    });

    it('returns NOT_FOUND when calendar does not exist', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(null);

      const result = await invoke<CalendarSource>('db:calendars:setEnabled', {
        id: 'missing',
        enabled: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NOT_FOUND');
        expect(result.error).toBe('Calendar not found');
      }
      expect(repo.setCalendarEnabled).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR when id is missing', async () => {
      const result = await invoke<CalendarSource>('db:calendars:setEnabled', {
        id: '',
        enabled: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('id is required');
      }
    });

    it('returns VALIDATION_ERROR when enabled is not a boolean', async () => {
      const result = await invoke<CalendarSource>('db:calendars:setEnabled', {
        id: 'cal-1',
        enabled: 'true' as unknown,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('enabled must be a boolean');
      }
    });

    it('returns VALIDATION_ERROR for invalid input object', async () => {
      const result = await invoke<CalendarSource>('db:calendars:setEnabled', 'not-an-object');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toContain('expected { id: string; enabled: boolean }');
      }
    });

    it('returns an error result when the repository throws', async () => {
      vi.mocked(repo.getCalendar).mockReturnValue(makeCalendar());
      vi.mocked(repo.setCalendarEnabled).mockRejectedValue(new Error('set enabled failed'));

      const result = await invoke<CalendarSource>('db:calendars:setEnabled', {
        id: 'cal-1',
        enabled: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('set enabled failed');
      expect(sendEventToRenderers).not.toHaveBeenCalled();
    });
  });
});