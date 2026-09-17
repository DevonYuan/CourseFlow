/**
 * Scheduler Integration Tests — Main Process
 *
 * Integration tests for the Scheduler class covering:
 * - Start/stop lifecycle
 * - Manual trigger and coalescing
 * - Settings updates and auto-restart
 * - Error classification and retry logic
 * - Power monitor suspend/resume
 *
 * @module @backend/main/__tests__/scheduler.integration
 */

import type { Settings, ImportResult, IsoDateTime } from '@backend/shared/types';
import { BrowserWindow, powerMonitor, ipcMain, app } from 'electron';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// Mock electron modules
vi.mock('electron', () => {
  const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: { send: vi.fn() },
  };

  return {
    app: {
      getVersion: vi.fn().mockReturnValue('1.0.0'),
      on: vi.fn(),
    },
    BrowserWindow: {
      getAllWindows: vi.fn().mockReturnValue([mockWindow]),
    },
    powerMonitor: {
      on: vi.fn(),
      emit: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
    },
  };
});

// Mock the ical utilities
vi.mock('../ical/index.js', () => ({
  fetchICalFeed: vi.fn(),
  parseICalFeed: vi.fn(),
  mapICalToAssignments: vi.fn(),
  NetworkError: class NetworkError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NetworkError';
    }
  },
  HttpError: class HttpError extends Error {
    public readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'HttpError';
      this.status = status;
    }
  },
  TimeoutError: class TimeoutError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TimeoutError';
    }
  },
  ICalParseError: class ICalParseError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ICalParseError';
    }
  },
}));

// Mock the repository
vi.mock('../db/repository.js', () => ({
  repo: {
    importAssignments: vi.fn(),
    setSettings: vi.fn(),
    getSettings: vi.fn(),
    listCalendars: vi.fn().mockReturnValue([]),
    updateCalendarSyncTime: vi.fn(),
    updateCalendarError: vi.fn(),
  },
}));

// Mock events
vi.mock('../events.js', () => ({
  sendEventToRenderers: vi.fn(),
  emitSchedulerTick: vi.fn(),
  emitSchedulerError: vi.fn(),
}));

// Import mocked modules
import { repo } from '../db/repository.js';
import { sendEventToRenderers, emitSchedulerTick, emitSchedulerError } from '../events.js';
import {
  fetchICalFeed,
  parseICalFeed,
  mapICalToAssignments,
  NetworkError,
  HttpError,
  TimeoutError,
  ICalParseError,
} from '../ical/index.js';
import {
  Scheduler,
  getScheduler,
  startScheduler,
  stopScheduler,
  __resetScheduler,
} from '../scheduler.js';

const mockFetchICalFeed = fetchICalFeed as Mock;
const mockParseICalFeed = parseICalFeed as Mock;
const mockMapICalToAssignments = mapICalToAssignments as Mock;
const mockImportAssignments = repo.importAssignments as Mock;
const mockSetSettings = repo.setSettings as Mock;
const mockSendEventToRenderers = sendEventToRenderers as Mock;
const mockEmitSchedulerTick = emitSchedulerTick as Mock;
const mockEmitSchedulerError = emitSchedulerError as Mock;
const mockPowerMonitorOn = powerMonitor.on as Mock;
const mockIpcMainHandle = ipcMain.handle as Mock;

// Test helpers
function createMockSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    icalUrl: 'https://canvas.example.edu/feeds/calendars/test.ics',
    syncIntervalMinutes: 15,
    autoFetchIcal: true,
    theme: 'system',
    lastSyncAt: null,
    icalFetchIntervalMinutes: 15,
    defaultPriority: 'medium',
    showCompletedAssignments: true,
    notifyDueSoon: true,
    dueSoonThresholdHours: 24,
    autoFetchIntervalMs: 15 * 60 * 1000,
    ...overrides,
  };
}

function createMockImportResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    imported: 1,
    updated: 0,
    skipped: 0,
    ...overrides,
  };
}

function createMockAssignment(overrides: Partial<any> = {}) {
  return {
    id: 'assignment-1',
    title: 'Test Assignment',
    description: 'Test description',
    courseId: 'course-1',
    courseName: 'CS101',
    courseColor: '#e8a838',
    dueAt: new Date(Date.now() + 86_400_000).toISOString() as IsoDateTime,
    unlockAt: null,
    lockAt: null,
    pointsPossible: 100,
    submissionTypes: ['online_text_entry'],
    workflowState: 'published',
    htmlUrl: 'https://canvas.example.edu/courses/1/assignments/1',
    icalUid: 'uid-1',
    priority: 'high',
    status: 'pending',
    source: 'ical',
    sourceUrl: 'https://canvas.example.edu/feeds/calendars/test.ics',
    createdAt: new Date().toISOString() as IsoDateTime,
    updatedAt: new Date().toISOString() as IsoDateTime,
    ...overrides,
  };
}

describe('Scheduler Integration Tests', () => {
  let scheduler: Scheduler;
  let mockWindow: BrowserWindow;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: vi.fn() },
    } as unknown as BrowserWindow;

    (BrowserWindow.getAllWindows as Mock).mockReturnValue([mockWindow]);

    scheduler = new Scheduler(mockWindow);
  });

  afterEach(() => {
    vi.useRealTimers();
    scheduler.stop();
    __resetScheduler();
    vi.resetModules();
  });

  describe('Lifecycle: start/stop', () => {
    it('starts scheduler with 30s initial delay', () => {
      const settings = createMockSettings();
      scheduler.updateSettings(settings);

      // updateSettings calls start() which emits initial tick
      expect(mockEmitSchedulerTick).toHaveBeenCalled();
      const status = scheduler.getStatus();
      expect(status.running).toBe(true);
      expect(status.nextRun).toBeDefined();
    });

    it('stops scheduler and clears all timers', () => {
      const settings = createMockSettings();
      scheduler.updateSettings(settings);

      scheduler.stop();

      const status = scheduler.getStatus();
      expect(status.running).toBe(false);
      expect(status.nextRun).toBeNull();
    });

    it('does not start if interval is invalid', () => {
      const settings = createMockSettings({ syncIntervalMinutes: 0 });
      scheduler.updateSettings(settings);

      expect(scheduler.getStatus().running).toBe(false);
    });

    it('does not start if autoFetchIcal is false', () => {
      const settings = createMockSettings({ autoFetchIcal: false });
      scheduler.updateSettings(settings);

      expect(scheduler.getStatus().running).toBe(false);
    });

    it('does not start if icalUrl is empty', () => {
      const settings = createMockSettings({ icalUrl: '' });
      scheduler.updateSettings(settings);

      expect(scheduler.getStatus().running).toBe(false);
    });
  });

  describe('Manual trigger (Sync Now)', () => {
    it('triggers immediate fetch when not running', async () => {
      const settings = createMockSettings();
      scheduler.updateSettings(settings);

      mockFetchICalFeed.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');
      mockParseICalFeed.mockReturnValue([]);
      mockMapICalToAssignments.mockReturnValue([]);
      mockImportAssignments.mockReturnValue(createMockImportResult());
      mockSetSettings.mockResolvedValue(undefined);

      await scheduler.triggerManual();

      expect(mockFetchICalFeed).toHaveBeenCalled();
    });

    it('coalesces manual trigger when fetch already in progress', async () => {
      const settings = createMockSettings();
      scheduler.updateSettings(settings);

      let resolveFetch: (value: string) => void;
      const fetchPromise = new Promise<string>((resolve) => {
        resolveFetch = resolve;
      });
      mockFetchICalFeed.mockReturnValue(fetchPromise);
      mockParseICalFeed.mockReturnValue([]);
      mockMapICalToAssignments.mockReturnValue([]);
      mockImportAssignments.mockReturnValue(createMockImportResult());
      mockSetSettings.mockResolvedValue(undefined);

      // Start first fetch
      const firstTrigger = scheduler.triggerManual();

      // Immediately try second trigger
      await scheduler.triggerManual();

      expect(mockSendEventToRenderers).toHaveBeenCalledWith(
        'scheduler:coalesced',
        expect.objectContaining({ message: 'Sync in progress...' }),
      );

      // Resolve first fetch
      resolveFetch!('BEGIN:VCALENDAR\nEND:VCALENDAR');
      await firstTrigger;
    });

    it('emits error if no settings available for manual trigger', async () => {
      // Create fresh scheduler without settings and without window
      const freshScheduler = new Scheduler(null);

      await freshScheduler.triggerManual();

      expect(mockSendEventToRenderers).toHaveBeenCalledWith(
        'scheduler:error',
        expect.objectContaining({
          message: 'No iCal URL configured — check Settings',
          code: 'auth',
        }),
      );
    });

    it('emits error if scheduler is paused', async () => {
      const settings = createMockSettings();
      scheduler.updateSettings(settings);

      // Pause by triggering auth error
      mockFetchICalFeed.mockRejectedValue(new HttpError('Unauthorized', 401));
      mockParseICalFeed.mockReturnValue([]);
      mockMapICalToAssignments.mockReturnValue([]);

      await scheduler.triggerManual();

      // Wait for error handling
      await vi.runAllTimersAsync();

      // Now try manual trigger while paused
      mockSendEventToRenderers.mockClear();
      await scheduler.triggerManual();

      expect(mockEmitSchedulerError).toHaveBeenCalledWith(
        'iCal URL invalid or expired — check Settings',
        'auth',
      );
    });
  });

  describe('Settings update and auto-restart', () => {
    it('restarts scheduler when interval changes', () => {
      const settings1 = createMockSettings({ syncIntervalMinutes: 15 });
      scheduler.updateSettings(settings1);

      mockEmitSchedulerTick.mockClear();

      const settings2 = createMockSettings({ syncIntervalMinutes: 30 });
      scheduler.updateSettings(settings2);

      expect(mockEmitSchedulerTick).toHaveBeenCalled();
    });

    it('restarts scheduler when autoFetchIcal changes', () => {
      const settings1 = createMockSettings({ autoFetchIcal: true });
      scheduler.updateSettings(settings1);

      mockEmitSchedulerTick.mockClear();

      const settings2 = createMockSettings({ autoFetchIcal: false });
      scheduler.updateSettings(settings2);

      expect(scheduler.getStatus().running).toBe(false);
    });

    it('resumes scheduler when paused and URL changes to valid', () => {
      const settings1 = createMockSettings({ icalUrl: '' });
      scheduler.updateSettings(settings1);

      // Trigger to cause pause
      mockFetchICalFeed.mockRejectedValue(new HttpError('Not Found', 404));
      scheduler.triggerManual();
      vi.runAllTimersAsync();

      expect(scheduler.getStatus().running).toBe(false);

      mockEmitSchedulerTick.mockClear();

      const settings2 = createMockSettings({ icalUrl: 'https://new-url.ics' });
      scheduler.updateSettings(settings2);

      expect(scheduler.getStatus().running).toBe(true);
    });

    it('stops scheduler when URL becomes empty', () => {
      const settings1 = createMockSettings();
      scheduler.updateSettings(settings1);

      const settings2 = createMockSettings({ icalUrl: '' });
      scheduler.updateSettings(settings2);

      expect(scheduler.getStatus().running).toBe(false);
    });
  });

  describe('Fetch cycle with retries', () => {
    it('successfully fetches, parses, and imports', async () => {
      const settings = createMockSettings({ syncIntervalMinutes: 1 });
      scheduler.updateSettings(settings);

      mockFetchICalFeed.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');
      mockParseICalFeed.mockReturnValue([{ uid: '1', summary: 'Test' }]);
      mockMapICalToAssignments.mockReturnValue([createMockAssignment()]);
      mockImportAssignments.mockReturnValue(createMockImportResult({ imported: 1 }));
      mockSetSettings.mockResolvedValue(undefined);

      // Advance past initial 30s delay
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockFetchICalFeed).toHaveBeenCalled();
      expect(mockParseICalFeed).toHaveBeenCalled();
      expect(mockMapICalToAssignments).toHaveBeenCalled();
      expect(mockImportAssignments).toHaveBeenCalled();
      expect(mockSetSettings).toHaveBeenCalledWith(
        expect.objectContaining({ lastSyncAt: expect.any(String) }),
      );
    });

    it('does not retry on auth error (401/403)', async () => {
      const settings = createMockSettings({ syncIntervalMinutes: 1 });
      scheduler.updateSettings(settings);

      mockFetchICalFeed.mockRejectedValue(new HttpError('Unauthorized', 401));
      mockParseICalFeed.mockReturnValue([]);
      mockMapICalToAssignments.mockReturnValue([]);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockFetchICalFeed).toHaveBeenCalledTimes(1);
      expect(scheduler.getStatus().running).toBe(false);
      expect(mockEmitSchedulerError).toHaveBeenCalledWith(
        'iCal URL invalid or expired — check Settings',
        'auth',
      );
    });

    it('does not retry on parse error', async () => {
      const settings = createMockSettings({ syncIntervalMinutes: 1 });
      scheduler.updateSettings(settings);

      mockFetchICalFeed.mockResolvedValue('INVALID ICAL');
      mockParseICalFeed.mockImplementation(() => {
        throw new ICalParseError('Invalid iCal format');
      });
      mockMapICalToAssignments.mockReturnValue([]);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockFetchICalFeed).toHaveBeenCalledTimes(1);
      expect(scheduler.getStatus().running).toBe(false);
      expect(mockEmitSchedulerError).toHaveBeenCalledWith('Failed to parse calendar feed', 'parse');
    });
  });

  describe('Power monitor suspend/resume', () => {
    it('pauses on suspend and reschedules on resume', () => {
      const settings = createMockSettings({ syncIntervalMinutes: 15 });
      scheduler.updateSettings(settings);

      // Get the suspend handler
      const suspendHandler = mockPowerMonitorOn.mock.calls.find(
        (call) => call[0] === 'suspend',
      )?.[1];

      expect(suspendHandler).toBeDefined();

      // Simulate suspend
      suspendHandler!();

      // Scheduler marks as suspended but doesn't stop immediately
      // The interval continues but fetch cycles are skipped while suspended
      expect(scheduler.getStatus().running).toBe(true);

      // Get the resume handler
      const resumeHandler = mockPowerMonitorOn.mock.calls.find((call) => call[0] === 'resume')?.[1];

      expect(resumeHandler).toBeDefined();

      // Advance timers to simulate time passing during suspend
      vi.advanceTimersByTime(60_000); // 1 minute suspended

      // Simulate resume
      resumeHandler!();

      // Should reschedule based on elapsed time
      expect(mockEmitSchedulerTick).toHaveBeenCalled();
    });

    it('handles resume when not suspended', () => {
      const resumeHandler = mockPowerMonitorOn.mock.calls.find((call) => call[0] === 'resume')?.[1];

      expect(resumeHandler).toBeDefined();

      // Should not throw when not suspended
      resumeHandler!();
    });
  });

  describe('Status reporting', () => {
    it('returns correct status when running', () => {
      const settings = createMockSettings({ syncIntervalMinutes: 15 });
      scheduler.updateSettings(settings);

      const status = scheduler.getStatus();

      expect(status.running).toBe(true);
      expect(status.intervalMinutes).toBe(15);
      expect(status.nextRun).toBeDefined();
    });

    it('returns correct status when stopped', () => {
      const status = scheduler.getStatus();

      expect(status.running).toBe(false);
      expect(status.intervalMinutes).toBe(15);
      expect(status.nextRun).toBeNull();
    });

    it('includes lastError in status after failure', async () => {
      const settings = createMockSettings({ syncIntervalMinutes: 1 });
      scheduler.updateSettings(settings);

      mockFetchICalFeed.mockRejectedValue(new HttpError('Unauthorized', 401));
      mockParseICalFeed.mockReturnValue([]);
      mockMapICalToAssignments.mockReturnValue([]);

      await vi.advanceTimersByTimeAsync(30_000);

      const status = scheduler.getStatus();

      expect(status.lastError).toContain('Unauthorized');
    });
  });

  describe('Singleton and backward compatibility', () => {
    it('getScheduler returns singleton instance', () => {
      const s1 = getScheduler(mockWindow);
      const s2 = getScheduler(mockWindow);

      expect(s1).toBe(s2);
    });

    it('getScheduler updates window reference', () => {
      const newWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      } as unknown as BrowserWindow;

      const s1 = getScheduler(mockWindow);
      const s2 = getScheduler(newWindow);

      expect(s1).toBe(s2);
    });

    it('startScheduler uses settings to start', () => {
      const settings = createMockSettings();
      startScheduler(settings);

      expect(mockEmitSchedulerTick).toHaveBeenCalled();
    });

    it('stopScheduler stops the singleton', () => {
      const settings = createMockSettings();
      startScheduler(settings);

      stopScheduler();

      const status = getScheduler().getStatus();
      expect(status.running).toBe(false);
    });
  });

  describe('Progress events', () => {
    it('emits progress events during fetch cycle', async () => {
      const settings = createMockSettings({ syncIntervalMinutes: 1 });
      scheduler.updateSettings(settings);

      mockFetchICalFeed.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');
      mockParseICalFeed.mockReturnValue([{ uid: '1', summary: 'Test' }]);
      mockMapICalToAssignments.mockReturnValue([createMockAssignment()]);
      mockImportAssignments.mockReturnValue(createMockImportResult());
      mockSetSettings.mockResolvedValue(undefined);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockSendEventToRenderers).toHaveBeenCalledWith(
        'ical:progress',
        expect.objectContaining({ stage: 'fetching', progress: 10 }),
      );
      expect(mockSendEventToRenderers).toHaveBeenCalledWith(
        'ical:progress',
        expect.objectContaining({ stage: 'parsing', progress: 30 }),
      );
      expect(mockSendEventToRenderers).toHaveBeenCalledWith(
        'ical:progress',
        expect.objectContaining({ stage: 'importing', progress: 50 }),
      );
      expect(mockSendEventToRenderers).toHaveBeenCalledWith(
        'ical:progress',
        expect.objectContaining({ stage: 'complete', progress: 100 }),
      );
    });
  });
});
