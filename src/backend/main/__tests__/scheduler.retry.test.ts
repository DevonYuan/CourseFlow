/**
 * Scheduler Retry Logic Tests — Main Process
 *
 * Focused tests for retry behavior without interference from other tests.
 *
 * @module @backend/main/__tests__/scheduler.retry
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { BrowserWindow, powerMonitor, ipcMain } from 'electron';

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
  },
}));

// Mock events
vi.mock('../events.js', () => ({
  sendEventToRenderers: vi.fn(),
  emitSchedulerTick: vi.fn(),
  emitSchedulerError: vi.fn(),
}));

// Import mocked modules
import { fetchICalFeed, parseICalFeed, mapICalToAssignments, NetworkError, HttpError } from '../ical/index.js';
import { repo } from '../db/repository.js';
import { sendEventToRenderers, emitSchedulerTick, emitSchedulerError } from '../events.js';
import { Scheduler, __resetScheduler } from '../scheduler.js';
import type { Settings, ImportResult, IsoDateTime } from '../shared/types.js';

const mockFetchICalFeed = fetchICalFeed as Mock;
const mockParseICalFeed = parseICalFeed as Mock;
const mockMapICalToAssignments = mapICalToAssignments as Mock;
const mockImportAssignments = repo.importAssignments as Mock;
const mockSetSettings = repo.setSettings as Mock;
const mockSendEventToRenderers = sendEventToRenderers as Mock;
const mockEmitSchedulerTick = emitSchedulerTick as Mock;
const mockEmitSchedulerError = emitSchedulerError as Mock;

function createMockSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    icalUrl: 'https://canvas.example.edu/feeds/calendars/test.ics',
    syncIntervalMinutes: 15,
    autoFetchIcal: true,
    theme: 'system',
    lastSyncAt: null,
    icalUrlEncrypted: null,
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
    dueAt: new Date(Date.now() + 86400000).toISOString() as IsoDateTime,
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

describe('Scheduler Retry Logic Tests', () => {
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

  it('retries on network error with exponential backoff', async () => {
    const settings = createMockSettings({ syncIntervalMinutes: 15 });
    scheduler['currentSettings'] = settings;

    mockFetchICalFeed
      .mockRejectedValueOnce(new NetworkError('Network error'))
      .mockRejectedValueOnce(new NetworkError('Network error'))
      .mockRejectedValueOnce(new NetworkError('Network error'))
      .mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');
    mockParseICalFeed.mockReturnValue([{ uid: '1', summary: 'Test' }]);
    mockMapICalToAssignments.mockReturnValue([createMockAssignment()]);
    mockImportAssignments.mockReturnValue(createMockImportResult({ imported: 1 }));
    mockSetSettings.mockResolvedValue(undefined);

    // Trigger manual fetch (don't await)
    scheduler.triggerManual();

    // Run all timers (retries) to completion
    await vi.runAllTimersAsync();

    // Should have retried 3 times then succeeded (4 total calls)
    expect(mockFetchICalFeed).toHaveBeenCalledTimes(4);
    expect(mockImportAssignments).toHaveBeenCalled();
  });

  it('pauses scheduler after max retries exhausted', async () => {
    const settings = createMockSettings({ syncIntervalMinutes: 15 });
    scheduler['currentSettings'] = settings;

    mockFetchICalFeed.mockRejectedValue(new NetworkError('Persistent network error'));
    mockParseICalFeed.mockReturnValue([{ uid: '1', summary: 'Test' }]);
    mockMapICalToAssignments.mockReturnValue([createMockAssignment()]);

    // Trigger manual fetch (don't await)
    scheduler.triggerManual();

    // Run all timers to exhaust retries
    await vi.runAllTimersAsync();

    // Should be paused after max retries
    expect(scheduler.getStatus().running).toBe(false);
    // Final error emission uses the classification message
    expect(mockEmitSchedulerError).toHaveBeenCalledWith(
      'Network error — retrying...',
      'network'
    );
  });

  it('retries on server error (5xx)', async () => {
    const settings = createMockSettings({ syncIntervalMinutes: 15 });
    scheduler['currentSettings'] = settings;

    mockFetchICalFeed
      .mockRejectedValueOnce(new HttpError('Server Error', 500))
      .mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');
    mockParseICalFeed.mockReturnValue([{ uid: '1', summary: 'Test' }]);
    mockMapICalToAssignments.mockReturnValue([createMockAssignment()]);
    mockImportAssignments.mockReturnValue(createMockImportResult({ imported: 1 }));
    mockSetSettings.mockResolvedValue(undefined);

    // Trigger manual fetch (don't await)
    scheduler.triggerManual();

    // Run all timers (retries) to completion
    await vi.runAllTimersAsync();

    expect(mockFetchICalFeed).toHaveBeenCalledTimes(2);
    expect(mockImportAssignments).toHaveBeenCalled();
  });
});
