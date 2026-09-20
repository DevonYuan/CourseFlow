/**
 * Auto-Fetch Scheduler — Main Process
 *
 * Periodically fetches and imports iCal data from multiple calendar sources
 * based on user settings. Runs in the Electron main process using setInterval.
 * Handles sleep/wake via power-monitor for accurate scheduling.
 * Implements retry logic with exponential backoff and error classification.
 * Each calendar source is synced independently — a failure on one never blocks others.
 *
 * @module @backend/main/scheduler
 */

import { BrowserWindow, powerMonitor } from 'electron';

import type { Settings, IsoDateTime, SchedulerConfig, SchedulerStatus, CalendarSource } from '../shared/types.js';

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
import { decryptIcalUrl } from './security/encryption.js';

/**
 * Scheduler — Background auto-fetch scheduler for iCal sync.
 *
 * Manages a single setInterval timer with sleep/wake awareness.
 * Emits scheduler:tick and scheduler:error events for UI updates.
 * Iterates over all enabled calendar sources on each cycle.
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

  // Retry state for current source
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelaysMs = [1000, 2000, 4000]; // 1s, 2s, 4s (exponential backoff)
  private retryTimer: NodeJS.Timeout | null = null;
  private isPaused = false;
  private pauseReason: string | null = null;

  // Per-source sync state for coalescing
  private isSyncing: Record<string, boolean> = {};

  /**
   * Creates a new Scheduler instance.
   * Sets up power-monitor listeners for sleep/wake handling.
   *
   * @param mainWindow - Reference to the main BrowserWindow for event emission
   */
  constructor(mainWindow: BrowserWindow | null = null) {
    this.mainWindow = mainWindow;
    this.setupPowerMonitor();
    // IPC handlers are registered in ipc-handlers.ts to avoid duplication
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
      void this.runFetchCycle();

      // Set up recurring interval after first run
      if (this.config.enabled && !this.intervalId) {
        const intervalMs = intervalMinutes * 60 * 1000;
        this.intervalId = setInterval(() => {
          void this.runFetchCycle();
        }, intervalMs);
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
      running:
        this.config.enabled &&
        (this.intervalId !== null || this.initialDelayTimer !== null) &&
        !this.isPaused,
      intervalMinutes: this.config.intervalMinutes,
      lastRun: this.config.lastRun,
      nextRun: this.config.nextRun,
      lastError: this.lastError,
    };
  }

  /**
   * Triggers an immediate fetch cycle for enabled sources (for "Sync Now" button).
   * Does not affect the regular interval schedule.
   * If a fetch is already in progress, ignores the request and emits a coalesced event.
   *
   * @param sourceId - When provided, sync only that calendar source (per-calendar
   *                   "Sync" action in the TopBar). Omit to sync all enabled sources.
   */
  async triggerManual(sourceId?: string): Promise<void> {
    if (!this.currentSettings) {
      console.warn('[Scheduler] No settings available for manual trigger');
      sendEventToRenderers('scheduler:error', {
        message: 'No calendar sources configured — check Settings',
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

    // Get enabled calendars, optionally narrowed to a single source
    const enabledCalendars = repo.listCalendars().filter((c) => c.enabled);
    const calendars = sourceId
      ? enabledCalendars.filter((c) => c.id === sourceId)
      : enabledCalendars;
    if (calendars.length === 0) {
      console.warn(
        sourceId
          ? `[Scheduler] Calendar source not found or disabled: ${sourceId}`
          : '[Scheduler] No enabled calendar sources for manual trigger',
      );
      sendEventToRenderers('scheduler:error', {
        message: 'No enabled calendar sources — check Settings',
        code: 'auth',
      });
      return;
    }

    // Check for per-source coalescing
    const alreadySyncing = calendars.filter((c) => this.isSyncing[c.id]);
    if (alreadySyncing.length > 0) {
      console.log(
        `[Scheduler] Manual trigger coalesced for ${alreadySyncing.length} source(s) already syncing`,
      );
      sendEventToRenderers('scheduler:coalesced', {
        message: `Sync already in progress for ${alreadySyncing.length} calendar(s)`,
        sourceIds: alreadySyncing.map((c) => c.id),
      });
      return;
    }

    console.log(
      sourceId
        ? `[Scheduler] Manual trigger initiated for source ${sourceId}`
        : '[Scheduler] Manual trigger initiated for all enabled sources',
    );
    await this.runFetchCycle(sourceId ? calendars : undefined);
  }

  /**
   * Updates the scheduler with new settings.
   * Restarts the interval if sync-relevant settings have changed.
   * Resumes scheduler if it was paused and calendar sources are now valid.
   *
   * @param settings - New application settings
   */
  updateSettings(settings: Settings): void {
    const oldInterval = this.currentSettings?.syncIntervalMinutes ?? 0;
    const newInterval = settings.syncIntervalMinutes;
    const oldAutoFetch = this.currentSettings?.autoFetchIcal ?? false;
    const newAutoFetch = settings.autoFetchIcal;

    this.currentSettings = settings;

    // Check if scheduling-relevant settings changed
    const intervalChanged = oldInterval !== newInterval;
    const autoFetchChanged = oldAutoFetch !== newAutoFetch;

    if (intervalChanged || autoFetchChanged) {
      console.log('[Scheduler] Settings changed, restarting scheduler');
      if (newAutoFetch && newInterval > 0) {
        this.start(newInterval);
      } else {
        this.stop();
      }
    }
  }

  /**
   * Performs a single fetch-and-import cycle for calendar sources.
   * Each source is processed independently with its own retry logic.
   * Per-source coalescing prevents overlapping syncs for the same source.
   *
   * @param onlySources - When provided, sync exactly these sources instead of
   *                      every enabled source (used by per-calendar manual sync).
   */
  private async runFetchCycle(onlySources?: CalendarSource[]): Promise<void> {
    if (!this.currentSettings) {
      console.warn('[Scheduler] No settings available, skipping fetch cycle');
      return;
    }

    const { autoFetchIcal, syncIntervalMinutes } = this.currentSettings;

    // For manual triggers, allow running even if autoFetchIcal is false
    // But for scheduled runs, respect the autoFetchIcal setting
    const isScheduledRun = this.intervalId !== null;
    if (isScheduledRun && (!autoFetchIcal || syncIntervalMinutes <= 0)) {
      console.log('[Scheduler] Auto-fetch disabled or not configured, skipping scheduled run');
      return;
    }

    if (this.isPaused) {
      console.log('[Scheduler] Fetch cycle skipped - scheduler is paused:', this.pauseReason);
      return;
    }

    // Get the calendar sources for this cycle: an explicit subset (per-calendar
    // manual sync) or every enabled source (scheduled / "sync all").
    const calendars = onlySources ?? repo.listCalendars().filter((c) => c.enabled);
    if (calendars.length === 0) {
      console.warn('[Scheduler] No enabled calendar sources, skipping fetch cycle');
      return;
    }

    this.isRunning = true;
    const now = new Date().toISOString() as IsoDateTime;
    this.config = {
      ...this.config,
      lastRun: now,
      nextRun: new Date(Date.now() + syncIntervalMinutes * 60 * 1000).toISOString() as IsoDateTime,
    };

    this.emitTick();
    console.log(`[Scheduler] Starting fetch cycle for ${calendars.length} source(s)`);

    // Process each calendar source sequentially
    for (const calendar of calendars) {
      // Check if scheduler was stopped/paused during processing
      if (this.isPaused || !this.isRunning) {
        console.log('[Scheduler] Stopped/paused during cycle, aborting remaining sources');
        break;
      }

      // Per-source coalescing: skip if this source is already syncing
      if (this.isSyncing[calendar.id]) {
        console.log(`[Scheduler] Skipping "${calendar.name}" - already syncing`);
        continue;
      }

      this.isSyncing[calendar.id] = true;
      try {
        await this.fetchAndImportForSource(calendar, syncIntervalMinutes);
      } finally {
        this.isSyncing[calendar.id] = false;
      }
    }

    // Mark cycle complete
    this.isRunning = false;
    this.emitTick();
  }

  /**
   * Core fetch and import logic for a single calendar source with retry handling.
   *
   * @param calendar - The calendar source to sync
   * @param syncIntervalMinutes - Sync interval for next run calculation
   */
  private async fetchAndImportForSource(
    calendar: CalendarSource,
    syncIntervalMinutes: number,
  ): Promise<void> {
    this.retryCount = 0;

    try {
      // Decrypt the feed URL
      let feedUrl: string;
      try {
        const parsed = JSON.parse(calendar.feedUrl);
        feedUrl = await decryptIcalUrl(parsed);
      } catch {
        console.error(`[Scheduler] Failed to decrypt feed URL for calendar ${calendar.id}`);
        this.emitErrorForSource(calendar.id, calendar.name, 'Failed to decrypt feed URL', 'auth');
        await repo.updateCalendarError(calendar.id, 'Failed to decrypt feed URL');
        return;
      }

      await this.fetchWithRetries(calendar, feedUrl, syncIntervalMinutes);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Scheduler] Unexpected error for calendar ${calendar.id}:`, message);
      this.emitErrorForSource(calendar.id, calendar.name, message, 'unknown');
      await repo.updateCalendarError(calendar.id, message);
    }
  }

  /**
   * Performs fetch with retry logic for a single source.
   */
  private async fetchWithRetries(
    calendar: CalendarSource,
    feedUrl: string,
    syncIntervalMinutes: number,
  ): Promise<void> {
    const attemptNumber = this.retryCount + 1;
    const maxAttempts = this.maxRetries + 1;

    try {
      // Emit progress: fetching
      this.emitProgressForSource(
        calendar.id,
        calendar.name,
        'fetching',
        10,
        `Fetching "${calendar.name}"... (attempt ${attemptNumber}/${maxAttempts})`,
      );

      // Fetch iCal feed with 30s timeout, no internal retries (scheduler handles retries)
      const icalText = await fetchICalFeed(feedUrl, { timeoutMs: 30_000, maxRetries: 1 });

      // Emit progress: parsing
      this.emitProgressForSource(calendar.id, calendar.name, 'parsing', 30, 'Parsing events...');

      // Parse iCal feed
      const events = parseICalFeed(icalText);

      if (events.length === 0) {
        this.emitProgressForSource(calendar.id, calendar.name, 'complete', 100, 'No events found');
        await this.onFetchSuccessForSource(calendar, 0, 0, 0);
        return;
      }

      // Emit progress: importing
      this.emitProgressForSource(calendar.id, calendar.name, 'importing', 50, 'Importing assignments...');

      // Map iCal events to assignments
      const assignments = mapICalToAssignments(events, feedUrl, calendar.id);

      // Import assignments with deduplication (per-source, preserves priority/notes/subtasks)
      const result = repo.importAssignments(assignments, calendar.id);

      // Update calendar source's last_sync_at and next_sync_at
      const syncNow = Date.now();
      await repo.updateCalendarSyncTime(calendar.id, syncNow, syncIntervalMinutes);

      // Also update legacy settings for backward compatibility
      await repo.setSettings({ lastSyncAt: new Date(syncNow).toISOString() as IsoDateTime });

      await this.onFetchSuccessForSource(
        calendar,
        result.imported,
        result.updated,
        result.skipped,
      );
    } catch (error) {
      await this.handleFetchErrorForSource(error, calendar, feedUrl, syncIntervalMinutes);
    }
  }

  /**
   * Handles successful fetch and import for a single source.
   *
   * @param calendar - The calendar source
   * @param imported - Number of newly imported assignments
   * @param updated - Number of updated assignments
   * @param skipped - Number of skipped assignments
   */
  private async onFetchSuccessForSource(
    calendar: CalendarSource,
    imported: number,
    updated: number,
    skipped: number,
  ): Promise<void> {
    // Reset retry state on success
    this.retryCount = 0;
    this.lastError = null;

    // Emit completion progress
    this.emitProgressForSource(
      calendar.id,
      calendar.name,
      'complete',
      100,
      `"${calendar.name}": imported ${imported}, updated ${updated}, skipped ${skipped}`,
    );

    // Update calendar's last_error to null on success
    await repo.updateCalendarError(calendar.id, null);

    // Structured logging
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'scheduler',
        event: 'fetch_success',
        sourceId: calendar.id,
        sourceName: calendar.name,
        imported,
        updated,
        skipped,
      }),
    );
  }

  /**
   * Handles fetch/import errors for a single source with classification and retry logic.
   * Errors on one source never block other sources.
   *
   * @param error - The error that occurred
   * @param calendar - The calendar source
   * @param feedUrl - The decrypted feed URL
   * @param syncIntervalMinutes - Sync interval for next run calculation
   */
  private async handleFetchErrorForSource(
    error: unknown,
    calendar: CalendarSource,
    feedUrl: string,
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
        sourceId: calendar.id,
        sourceName: calendar.name,
        attempt: this.retryCount + 1,
        maxAttempts: this.maxRetries + 1,
        errorCode: classification.code,
        retryable: classification.retryable,
        message: classification.userMessage,
        originalError: message,
      }),
    );

    // Update calendar's last_error
    this.lastError = message;
    await repo.updateCalendarError(calendar.id, message);

    // Schedule next_sync_at even on failure (so the source will be retried on next cycle)
    const syncNow = Date.now();
    const nextSyncAt = syncNow + syncIntervalMinutes * 60 * 1000;
    await repo.updateCalendarNextSyncAt(calendar.id, nextSyncAt);

    // Emit error progress
    this.emitProgressForSource(
      calendar.id,
      calendar.name,
      'error',
      100,
      `"${calendar.name}": ${classification.userMessage}`,
    );

    // Emit scheduler error event with sourceId and sourceName
    this.emitErrorForSource(calendar.id, calendar.name, classification.userMessage, classification.code);

    if (classification.retryable && this.retryCount < this.maxRetries) {
      // Schedule retry with exponential backoff
      const delayMs = (this.retryDelaysMs[this.retryCount] ?? this.retryDelaysMs.at(-1)) as number;
      this.retryCount++;
      console.log(
        `[Scheduler] Scheduling retry ${this.retryCount}/${this.maxRetries} for "${calendar.name}" in ${delayMs / 1000}s`,
      );

      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (!this.isPaused && this.isRunning) {
          void this.fetchWithRetries(calendar, feedUrl, syncIntervalMinutes);
        }
      }, delayMs);

      if (this.retryTimer.unref) {
        this.retryTimer.unref();
      }
    } else {
      // Max retries exhausted or non-retryable error - mark this source as failed but continue
      console.log(`[Scheduler] Source "${calendar.name}" failed permanently: ${classification.userMessage}`);
      // Don't pause the entire scheduler - just this source's sync is done for this cycle
      // The source will be retried on the next scheduled cycle
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
          userMessage: 'Calendar URL invalid or expired — check Settings',
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
        userMessage: 'Calendar URL invalid or expired — check Settings',
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
        userMessage: 'Failed to decrypt calendar URL — check Settings',
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
   * Pauses the scheduler due to a non-retryable error affecting ALL sources.
   * This is now rare since errors are per-source.
   *
   * @param reason - The reason for pausing
   */
  private pauseScheduler(reason: string): void {
    this.isPaused = true;
    this.pauseReason = reason;
    this.isRunning = false;
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
   * Called when settings are updated with valid calendar sources.
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
  private rescheduleAfterWake(_suspendedDurationMs: number): void {
    if (!this.currentSettings || this.intervalId === null) {
      return;
    }

    const intervalMs = this.currentSettings.syncIntervalMinutes * 60 * 1000;
    const timeSinceLastRun = this.config.lastRun
      ? Date.now() - new Date(this.config.lastRun).getTime()
      : intervalMs;

    // Calculate when the next run should have occurred
    const elapsedIntervals = Math.floor(timeSinceLastRun / intervalMs);
    const expectedNextRun =
      (this.config.lastRun ? new Date(this.config.lastRun).getTime() : Date.now()) +
      (elapsedIntervals + 1) * intervalMs;

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
      void this.runFetchCycle();

      if (this.config.enabled && !this.intervalId) {
        this.intervalId = setInterval(() => {
          void this.runFetchCycle();
        }, intervalMs);
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
  private emitError(
    message: string,
    code: 'network' | 'auth' | 'parse' | 'server' | 'unknown',
  ): void {
    emitSchedulerError(message, code);
  }

  /**
   * Emits scheduler:error event with sourceId and sourceName for multi-calendar tracking.
   */
  private emitErrorForSource(
    sourceId: string,
    sourceName: string,
    message: string,
    code: 'network' | 'auth' | 'parse' | 'server' | 'unknown',
  ): void {
    // Extend the event with sourceId and sourceName
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('scheduler:error', { message, code, sourceId, sourceName });
      }
    }
  }

  /**
   * Emits ical:progress event to all renderer windows with sourceId and sourceName.
   */
  private emitProgressForSource(
    sourceId: string,
    sourceName: string,
    stage: 'fetching' | 'parsing' | 'importing' | 'complete' | 'error',
    progress: number,
    message?: string,
  ): void {
    sendEventToRenderers('ical:progress' as const, { stage, progress, message, sourceId, sourceName });
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
 * Resets the singleton scheduler instance (for testing only).
 * Stops the current scheduler if running and clears the instance.
 */
export function __resetScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
  }
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
}

/**
 * Updates the scheduler with new settings (backward compatibility function).
 *
 * @param settings - Application settings
 */
export function updateScheduler(settings: Settings): void {
  const scheduler = getScheduler();
  scheduler.updateSettings(settings);
}

/**
 * Stops the scheduler (backward compatibility function).
 */
export function stopScheduler(): void {
  const scheduler = getScheduler();
  scheduler.stop();
}