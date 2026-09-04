/**
 * Auto-Fetch Scheduler — Main Process
 *
 * Periodically fetches and imports iCal data based on user settings.
 * Runs in the Electron main process using setInterval.
 * Handles sleep/wake via power-monitor for accurate scheduling.
 * Implements retry logic with exponential backoff and error classification.
 *
 * @module @backend/main/scheduler
 */

import { app, powerMonitor, ipcMain, BrowserWindow } from 'electron';

import type { Settings, IsoDateTime, SchedulerConfig, SchedulerStatus, ImportResult } from '../shared/types.js';
import { repo } from './db/repository.js';
import { sendEventToRenderers, emitSchedulerTick, emitSchedulerError } from './events.js';
import {
  fetchICalFeed,
  parseICalFeed,
  mapICalToAssignments,
  NetworkError,
  HttpError,
  TimeoutError,
  ICalParseError,
} from './ical/index.js';
import { DecryptionError } from './security/encryption.js';

/**
 * Scheduler — Background auto-fetch scheduler for iCal sync.
 *
 * Manages a single setInterval timer with sleep/wake awareness.
 * Emits scheduler:tick and scheduler:error events for UI updates.
 */
export class Scheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private currentSettings: Settings | null = null;
  private config: SchedulerConfig = {
    enabled: false,
    intervalMinutes: 15,
    lastRun: null,
    nextRun: null,
  };
  private lastError: string | null = null;
  private initialDelayTimer: NodeJS.Timeout | null = null;
  private suspended = false;
  private suspendTime: number | null = null;
  private mainWindow: BrowserWindow | null = null;

  // Retry state for current tick
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelaysMs = [60_000, 120_000, 240_000]; // 1min, 2min, 4min
  private retryTimer: NodeJS.Timeout | null = null;
  private isPaused = false;
  private pauseReason: string | null = null;

  /**
   * Creates a new Scheduler instance.
   * Sets up power-monitor listeners for sleep/wake handling.
   *
   * @param mainWindow - Reference to the main BrowserWindow for event emission
   */
  constructor(mainWindow: BrowserWindow | null = null) {
    this.mainWindow = mainWindow;
    this.setupPowerMonitor();
    this.setupIpcHandlers();
  }

  /**
   * Sets up power-monitor listeners for suspend/resume handling.
   * On suspend: pauses the scheduler and records suspend time.
   * On resume: recalculates nextRun based on elapsed time.
   */
  private setupPowerMonitor(): void {
    powerMonitor.on('suspend', (): void => {
      this.suspended = true;
      this.suspendTime = Date.now();
      console.log('[Scheduler] System suspended, pausing scheduler');
    });

    powerMonitor.on('resume', (): void => {
      if (!this.suspended || this.suspendTime === null) {
        return;
      }

      const suspendedDuration = Date.now() - this.suspendTime;
      this.suspended = false;
      this.suspendTime = null;

      console.log(`[Scheduler] System resumed after ${Math.round(suspendedDuration / 1000)}s`);

      // If scheduler is enabled, reschedule next run based on elapsed time
      if (this.config.enabled && this.currentSettings) {
        this.rescheduleAfterWake(suspendedDuration);
      }
    });
  }

  /**
   * Sets up IPC handlers for scheduler control from renderer.
   * These handlers allow the renderer to start/stop/check status of the scheduler.
   */
  private setupIpcHandlers(): void {
    ipcMain.handle('scheduler:start', async (): Promise<void> => {
      if (this.currentSettings) {
        this.start(this.currentSettings.syncIntervalMinutes);
      }
    });

    ipcMain.handle('scheduler:stop', async (): Promise<void> => {
      this.stop();
    });

    ipcMain.handle('scheduler:status', async (): Promise<SchedulerStatus> => {
      return this.getStatus();
    });

    ipcMain.handle('scheduler:trigger', async (): Promise<void> => {
      await this.triggerManual();
    });
  }

  /**
   * Updates the main window reference (e.g., after window recreation).
   *
   * @param mainWindow - The main BrowserWindow instance
   */
  setMainWindow(mainWindow: BrowserWindow | null): void {
    this.mainWindow = mainWindow;
  }

  /**
   * Starts or restarts the scheduler with the given interval.
   * Waits 30 seconds before first run to avoid startup contention.
   * Clears paused state when explicitly started.
   *
   * @param intervalMinutes - Sync interval in minutes (from settings.sync_interval_minutes)
   */
  start(intervalMinutes: number): void {
    // Stop any existing scheduler
    this.stop();

    // Clear paused state on explicit start
    this.isPaused = false;
    this.pauseReason = null;

    // Validate interval
    if (intervalMinutes <= 0) {
      console.log('[Scheduler] Invalid interval, scheduler not started');
      this.config = {
        ...this.config,
        enabled: false,
        intervalMinutes,
      };
      return;
    }

    console.log(`[Scheduler] Starting scheduler (interval: ${intervalMinutes} min)`);

    this.config = {
      enabled: true,
      intervalMinutes,
      lastRun: this.config.lastRun,
      nextRun: new Date(Date.now() + 30_000).toISOString() as IsoDateTime, // 30s initial delay
    };

    // Emit initial tick with nextRun
    this.emitTick();

    // Wait 30 seconds before first fetch to avoid startup contention
    this.initialDelayTimer = setTimeout(() => {
      this.initialDelayTimer = null;
      this.runFetchCycle();

      // Set up recurring interval after first run
      if (this.config.enabled && !this.intervalId) {
        const intervalMs = intervalMinutes * 60 * 1000;
        this.intervalId = setInterval(() => this.runFetchCycle(), intervalMs);
        if (this.intervalId.unref) {
          this.intervalId.unref();
        }
        this.updateNextRun();
        this.emitTick();
      }
    }, 30_000);

    if (this.initialDelayTimer.unref) {
      this.initialDelayTimer.unref();
    }
  }

  /**
   * Stops the scheduler and clears all timers.
   * Safe to call multiple times.
   */
  stop(): void {
    if (this.initialDelayTimer) {
      clearTimeout(this.initialDelayTimer);
      this.initialDelayTimer = null;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] Stopped scheduler');
    }

    this.config = {
      ...this.config,
      enabled: false,
      nextRun: null,
    };
    this.retryCount = 0;
  }

  /**
   * Gets the current scheduler status.
   *
   * @returns SchedulerStatus with running state, interval, lastRun, nextRun, lastError
   */
  getStatus(): SchedulerStatus {
    return {
      running: this.config.enabled && (this.intervalId !== null || this.initialDelayTimer !== null) && !this.isPaused,
      intervalMinutes: this.config.intervalMinutes,
      lastRun: this.config.lastRun,
      nextRun: this.config.nextRun,
      lastError: this.lastError,
    };
  }

  /**
   * Triggers an immediate fetch cycle (for "Sync Now" button).
   * Does not affect the regular interval schedule.
   * If a fetch is already in progress, ignores the request and emits a coalesced event.
   */
  async triggerManual(): Promise<void> {
    if (this.isRunning) {
      console.log('[Scheduler] Manual trigger skipped - fetch already in progress');
      // Emit coalesced event for UI toast notification
      sendEventToRenderers('scheduler:coalesced', {
        message: 'Sync in progress...',
      });
      return;
    }

    if (!this.currentSettings) {
      console.warn('[Scheduler] No settings available for manual trigger');
      sendEventToRenderers('scheduler:error', {
        message: 'No iCal URL configured — check Settings',
        code: 'auth',
      });
      return;
    }

    if (this.isPaused) {
      console.log('[Scheduler] Manual trigger skipped - scheduler is paused');
      sendEventToRenderers('scheduler:error', {
        message: this.pauseReason ?? 'Scheduler is paused — check Settings',
        code: 'auth',
      });
      return;
    }

    console.log('[Scheduler] Manual trigger initiated');
    await this.runFetchCycle();
  }

  /**
   * Updates the scheduler with new settings.
   * Restarts the interval if sync-relevant settings have changed.
   * Resumes scheduler if it was paused and iCal URL is now valid.
   *
   * @param settings - New application settings
   */
  updateSettings(settings: Settings): void {
    const oldInterval = this.currentSettings?.syncIntervalMinutes ?? 0;
    const newInterval = settings.syncIntervalMinutes;
    const oldAutoFetch = this.currentSettings?.autoFetchIcal ?? false;
    const newAutoFetch = settings.autoFetchIcal;
    const urlChanged = this.currentSettings?.icalUrl !== settings.icalUrl;
    const wasPaused = this.isPaused;

    this.currentSettings = settings;

    // If scheduler was paused and URL changed to a non-empty value, resume
    if (wasPaused && urlChanged && settings.icalUrl) {
      this.resumeScheduler();
    }

    // Check if scheduling-relevant settings changed
    const intervalChanged = oldInterval !== newInterval;
    const autoFetchChanged = oldAutoFetch !== newAutoFetch;

    if (intervalChanged || autoFetchChanged || urlChanged) {
      console.log('[Scheduler] Settings changed, restarting scheduler');
      if (newAutoFetch && newInterval > 0 && settings.icalUrl) {
        this.start(newInterval);
      } else {
        this.stop();
      }
    }
  }

  /**
   * Performs a single fetch-and-import cycle with retry logic.
   * Uses the existing ical:fetch → ical:import pipeline logic.
   * Guarded by isRunning flag to prevent overlapping runs.
   */
  private async runFetchCycle(): Promise<void> {
    if (this.isRunning) {
      console.log('[Scheduler] Fetch cycle skipped - already running');
      return;
    }

    if (!this.currentSettings) {
      console.warn('[Scheduler] No settings available, skipping fetch cycle');
      return;
    }

    const { autoFetchIcal, syncIntervalMinutes, icalUrl } = this.currentSettings;

    // For manual triggers, allow running even if autoFetchIcal is false
    // But for scheduled runs, respect the autoFetchIcal setting
    const isScheduledRun = this.intervalId !== null;
    if (isScheduledRun && (!autoFetchIcal || syncIntervalMinutes <= 0 || !icalUrl)) {
      console.log('[Scheduler] Auto-fetch disabled or not configured, skipping scheduled run');
      return;
    }

    if (!icalUrl) {
      console.warn('[Scheduler] No iCal URL configured, skipping fetch cycle');
      return;
    }

    if (this.isPaused) {
      console.log('[Scheduler] Fetch cycle skipped - scheduler is paused:', this.pauseReason);
      return;
    }

    this.isRunning = true;
    this.retryCount = 0;
    const now = new Date().toISOString() as IsoDateTime;
    this.config = {
      ...this.config,
      lastRun: now,
      nextRun: new Date(Date.now() + syncIntervalMinutes * 60 * 1000).toISOString() as IsoDateTime,
    };

    this.emitTick();
    console.log('[Scheduler] Starting fetch cycle (attempt 1/4)');

    await this.fetchAndImport(icalUrl, syncIntervalMinutes);

    this.isRunning = false;
    this.emitTick();
  }

  /**
   * Core fetch and import logic with retry handling.
   * Called by runFetchCycle and handles retries internally.
   *
   * @param icalUrl - The decrypted iCal feed URL
   * @param syncIntervalMinutes - Sync interval for next run calculation
   */
  private async fetchAndImport(icalUrl: string, syncIntervalMinutes: number): Promise<void> {
    const attemptNumber = this.retryCount + 1;
    const maxAttempts = this.maxRetries + 1; // 1 initial + 3 retries

    try {
      // Emit progress: fetching
      this.emitProgress('fetching', 10, `Fetching calendar... (attempt ${attemptNumber}/${maxAttempts})`);

      // Fetch iCal feed with 30s timeout, no internal retries (scheduler handles retries)
      const icalText = await fetchICalFeed(icalUrl, { timeoutMs: 30_000, maxRetries: 1 });

      // Emit progress: parsing
      this.emitProgress('parsing', 30, 'Parsing events...');

      // Parse iCal feed
      const events = parseICalFeed(icalText);

      if (events.length === 0) {
        this.emitProgress('complete', 100, 'No events found');
        this.onFetchSuccess(0, 0, 0, syncIntervalMinutes);
        return;
      }

      // Emit progress: importing
      this.emitProgress('importing', 50, 'Importing assignments...');

      // Map iCal events to assignments
      const assignments = mapICalToAssignments(events, icalUrl);

      // Import assignments with deduplication (preserves priority/notes/subtasks)
      const result = repo.importAssignments(assignments);

      // Update lastSyncAt in settings on successful import
      const syncNow = new Date().toISOString() as IsoDateTime;
      await repo.setSettings({ lastSyncAt: syncNow });

      this.onFetchSuccess(result.imported, result.updated, result.skipped, syncIntervalMinutes);
    } catch (error) {
      await this.handleFetchError(error, icalUrl, syncIntervalMinutes);
    }
  }

  /**
   * Handles successful fetch and import.
   *
   * @param imported - Number of newly imported assignments
   * @param updated - Number of updated assignments
   * @param skipped - Number of skipped assignments
   * @param syncIntervalMinutes - Sync interval for next run calculation
   */
  private onFetchSuccess(
    imported: number,
    updated: number,
    skipped: number,
    syncIntervalMinutes: number,
  ): void {
    const syncNow = new Date().toISOString() as IsoDateTime;

    // Update scheduler config
    this.config = {
      ...this.config,
      lastRun: syncNow,
      nextRun: new Date(Date.now() + syncIntervalMinutes * 60 * 1000).toISOString() as IsoDateTime,
    };

    // Reset retry state on success
    this.retryCount = 0;
    this.lastError = null;

    // Emit completion progress
    this.emitProgress(
      'complete',
      100,
      `Imported ${imported}, updated ${updated}, skipped ${skipped}`,
    );

    // Structured logging
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'scheduler',
        event: 'fetch_success',
        imported,
        updated,
        skipped,
        nextRun: this.config.nextRun,
      }),
    );
  }

  /**
   * Handles fetch/import errors with classification and retry logic.
   *
   * @param error - The error that occurred
   * @param icalUrl - The iCal feed URL
   * @param syncIntervalMinutes - Sync interval for next run calculation
   */
  private async handleFetchError(
    error: unknown,
    icalUrl: string,
    syncIntervalMinutes: number,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Classify error
    const classification = this.classifyError(error);

    // Structured error logging
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'scheduler',
        event: 'fetch_error',
        attempt: this.retryCount + 1,
        maxAttempts: this.maxRetries + 1,
        errorCode: classification.code,
        retryable: classification.retryable,
        message: classification.userMessage,
        originalError: message,
      }),
    );

    // Update last error
    this.lastError = message;
    this.config = {
      ...this.config,
      lastRun: new Date().toISOString() as IsoDateTime,
    };

    // Emit error progress
    this.emitProgress('error', 100, `Fetch failed: ${classification.userMessage}`);

    // Emit scheduler error event
    this.emitError(classification.userMessage, classification.code);

    if (classification.retryable && this.retryCount < this.maxRetries) {
      // Schedule retry with exponential backoff
      const delayMs = this.retryDelaysMs[this.retryCount];
      this.retryCount++;
      console.log(`[Scheduler] Scheduling retry ${this.retryCount}/${this.maxRetries} in ${delayMs / 1000}s`);

      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (!this.isPaused && this.isRunning) {
          this.fetchAndImport(icalUrl, syncIntervalMinutes);
        }
      }, delayMs);

      if (this.retryTimer.unref) {
        this.retryTimer.unref();
      }
    } else {
      // Max retries exhausted or non-retryable error - pause scheduler
      this.pauseScheduler(classification.userMessage);
    }
  }

  /**
   * Classifies an error into retryable/non-retryable with user-facing message.
   *
   * @param error - The error to classify
   * @returns Classification with code, retryable flag, and user message
   */
  private classifyError(error: unknown): {
    code: 'network' | 'auth' | 'parse' | 'server' | 'unknown';
    retryable: boolean;
    userMessage: string;
  } {
    // Network/timeout errors → retryable
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return {
        code: 'network',
        retryable: true,
        userMessage: 'Network error — retrying...',
      };
    }

    // HTTP errors → check status code
    if (error instanceof HttpError) {
      const status = error.status;
      // 401/403 → auth error, non-retryable
      if (status === 401 || status === 403) {
        return {
          code: 'auth',
          retryable: false,
          userMessage: 'iCal URL invalid or expired — check Settings',
        };
      }
      // 404/5xx → server error, retryable
      if (status === 404 || (status >= 500 && status < 600)) {
        return {
          code: 'server',
          retryable: true,
          userMessage: 'Server error — retrying...',
        };
      }
      // Other 4xx → treat as auth-like, non-retryable
      return {
        code: 'auth',
        retryable: false,
        userMessage: 'iCal URL invalid or expired — check Settings',
      };
    }

    // Parse errors → non-retryable
    if (error instanceof ICalParseError) {
      return {
        code: 'parse',
        retryable: false,
        userMessage: 'Failed to parse calendar feed',
      };
    }

    // Decryption errors → non-retryable
    if (error instanceof DecryptionError) {
      return {
        code: 'auth',
        retryable: false,
        userMessage: 'Failed to decrypt iCal URL — check Settings',
      };
    }

    // Unknown errors → retryable
    return {
      code: 'unknown',
      retryable: true,
      userMessage: 'Sync failed — retrying...',
    };
  }

  /**
   * Pauses the scheduler due to a non-retryable error.
   * Requires user action (update URL) to resume.
   *
   * @param reason - The reason for pausing
   */
  private pauseScheduler(reason: string): void {
    this.isPaused = true;
    this.pauseReason = reason;
    this.stop(); // Stop the interval timer

    console.log(`[Scheduler] Paused: ${reason}`);

    // Structured logging
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        component: 'scheduler',
        event: 'scheduler_paused',
        reason,
      }),
    );
  }

  /**
   * Resumes the scheduler after being paused.
   * Called when settings are updated with a valid iCal URL.
   */
  private resumeScheduler(): void {
    if (!this.isPaused) return;

    this.isPaused = false;
    this.pauseReason = null;

    console.log('[Scheduler] Resumed');

    // Structured logging
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'scheduler',
        event: 'scheduler_resumed',
      }),
    );

    // Restart with current settings if auto-fetch is enabled
    if (this.currentSettings?.autoFetchIcal && this.currentSettings.syncIntervalMinutes > 0) {
      this.start(this.currentSettings.syncIntervalMinutes);
    }
  }

  /**
   * Reschedules the next run after system wake.
   * Adjusts nextRun based on how long the system was suspended.
   *
   * @param suspendedDurationMs - Duration of suspend in milliseconds
   */
  private rescheduleAfterWake(suspendedDurationMs: number): void {
    if (!this.currentSettings || this.intervalId === null) {
      return;
    }

    const intervalMs = this.currentSettings.syncIntervalMinutes * 60 * 1000;
    const timeSinceLastRun = this.config.lastRun
      ? Date.now() - new Date(this.config.lastRun).getTime()
      : intervalMs;

    // Calculate when the next run should have occurred
    const elapsedIntervals = Math.floor(timeSinceLastRun / intervalMs);
    const expectedNextRun = (this.config.lastRun
      ? new Date(this.config.lastRun).getTime()
      : Date.now()) + (elapsedIntervals + 1) * intervalMs;

    const now = Date.now();
    let delay = expectedNextRun - now;

    // If we're past the expected time, run immediately
    if (delay <= 0) {
      delay = 0;
    }

    console.log(`[Scheduler] Rescheduling after wake, next run in ${Math.round(delay / 1000)}s`);

    // Clear existing interval and set new one with adjusted delay
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Run once after the calculated delay, then resume regular interval
    this.initialDelayTimer = setTimeout(() => {
      this.initialDelayTimer = null;
      this.runFetchCycle();

      if (this.config.enabled && !this.intervalId) {
        this.intervalId = setInterval(() => this.runFetchCycle(), intervalMs);
        if (this.intervalId.unref) {
          this.intervalId.unref();
        }
      }
    }, delay);

    if (this.initialDelayTimer.unref) {
      this.initialDelayTimer.unref();
    }

    this.updateNextRun();
    this.emitTick();
  }

  /**
   * Updates the nextRun timestamp based on current interval.
   */
  private updateNextRun(): void {
    if (!this.currentSettings) {
      return;
    }

    const intervalMs = this.currentSettings.syncIntervalMinutes * 60 * 1000;
    this.config = {
      ...this.config,
      nextRun: new Date(Date.now() + intervalMs).toISOString() as IsoDateTime,
    };
  }

  /**
   * Emits scheduler:tick event to all renderer windows.
   */
  private emitTick(): void {
    if (this.config.nextRun) {
      emitSchedulerTick(this.config.nextRun);
    }
  }

  /**
   * Emits scheduler:error event to all renderer windows.
   *
   * @param message - Error message
   * @param code - Error code category
   */
  private emitError(message: string, code: 'network' | 'auth' | 'parse' | 'unknown'): void {
    emitSchedulerError(message, code);
  }

  /**
   * Emits ical:progress event to all renderer windows.
   *
   * @param stage - Progress stage
   * @param progress - Progress percentage (0-100)
   * @param message - Optional message
   */
  private emitProgress(
    stage: 'fetching' | 'parsing' | 'importing' | 'complete' | 'error',
    progress: number,
    message?: string,
  ): void {
    sendEventToRenderers('ical:progress' as const, { stage, progress, message });
  }
}

// Module-level singleton instance for backward compatibility
let schedulerInstance: Scheduler | null = null;

/**
 * Gets the singleton scheduler instance, creating it if needed.
 *
 * @param mainWindow - Optional main window reference
 * @returns The Scheduler instance
 */
export function getScheduler(mainWindow?: BrowserWindow | null): Scheduler {
  if (!schedulerInstance) {
    schedulerInstance = new Scheduler(mainWindow ?? null);
  } else if (mainWindow) {
    schedulerInstance.setMainWindow(mainWindow);
  }
  return schedulerInstance;
}

/**
 * Starts the scheduler with settings (backward compatibility function).
 * Reads syncIntervalMinutes from settings.
 *
 * @param settings - Application settings
 */
export function startScheduler(settings: Settings): void {
  const scheduler = getScheduler();
  scheduler.updateSettings(settings);
  if (settings.autoFetchIcal && settings.syncIntervalMinutes > 0 && settings.icalUrl) {
    scheduler.start(settings.syncIntervalMinutes);
  }
}

/**
 * Stops the scheduler (backward compatibility function).
 */
export function stopScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}

/**
 * Updates the scheduler with new settings (backward compatibility function).
 *
 * @param settings - New application settings
 */
export function updateScheduler(settings: Settings): void {
  if (schedulerInstance) {
    schedulerInstance.updateSettings(settings);
  }
}

/**
 * Gets the current scheduler status (backward compatibility function).
 *
 * @returns SchedulerStatus
 */
export function getSchedulerStatus(): SchedulerStatus {
  if (schedulerInstance) {
    return schedulerInstance.getStatus();
  }
  return {
    running: false,
    intervalMinutes: 15,
    lastRun: null,
    nextRun: null,
    lastError: null,
  };
}