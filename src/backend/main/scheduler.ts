/**
 * Auto-Fetch Scheduler — Main Process
 *
 * Periodically fetches and imports iCal data based on user settings.
 * Runs in the Electron main process using setInterval.
 *
 * @module @backend/main/scheduler
 */

import type { Settings, IsoDateTime, SchedulerConfig, SchedulerStatus } from '../shared/types.js';
import { repo } from './db/repository.js';
import {
  fetchICalFeed,
  parseICalFeed,
  mapICalToAssignments,
  NetworkError,
  HttpError,
  TimeoutError,
  ICalParseError,
} from './ical/index.js';
import { sendEventToRenderers } from './events.js';

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;
let currentSettings: Settings | null = null;
let schedulerConfig: SchedulerConfig = {
  enabled: false,
  intervalMinutes: 15,
  lastRun: null,
  nextRun: null,
};

/**
 * Performs a single fetch-and-import cycle.
 * Reuses the same logic as manual sync (ical:fetch → ical:import).
 */
async function runFetchCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] Fetch cycle skipped - already running');
    return;
  }

  if (!currentSettings) {
    console.warn('[Scheduler] No settings available, skipping fetch cycle');
    return;
  }

  const { autoFetchIcal, icalFetchIntervalMinutes, icalUrl } = currentSettings;

  if (!autoFetchIcal || icalFetchIntervalMinutes <= 0 || !icalUrl) {
    console.log('[Scheduler] Auto-fetch disabled or not configured, skipping');
    return;
  }

  isRunning = true;
  const now = new Date().toISOString() as IsoDateTime;
  schedulerConfig = {
    ...schedulerConfig,
    lastRun: now,
    nextRun: new Date(Date.now() + icalFetchIntervalMinutes * 60 * 1000).toISOString() as IsoDateTime,
  };

  console.log('[Scheduler] Starting auto-fetch cycle');

  try {
    // Emit progress: fetching
    sendEventToRenderers('ical:progress', {
      stage: 'fetching',
      progress: 10,
      message: 'Auto-fetch: Fetching calendar...',
    });

    // Fetch iCal feed with 30s timeout
    const icalText = await fetchICalFeed(icalUrl, { timeoutMs: 30_000 });

    // Emit progress: parsing
    sendEventToRenderers('ical:progress', {
      stage: 'parsing',
      progress: 30,
      message: 'Auto-fetch: Parsing events...',
    });

    // Parse iCal feed
    const events = parseICalFeed(icalText);

    if (events.length === 0) {
      sendEventToRenderers('ical:progress', {
        stage: 'complete',
        progress: 100,
        message: 'Auto-fetch: No events found',
      });
      return;
    }

    // Emit progress: importing
    sendEventToRenderers('ical:progress', {
      stage: 'importing',
      progress: 50,
      message: 'Auto-fetch: Importing assignments...',
    });

    // Map iCal events to assignments
    const assignments = mapICalToAssignments(events, icalUrl);

    // Import assignments with deduplication
    const result = repo.importAssignments(assignments);

    // Update lastSyncAt in settings on successful import
    const syncNow = new Date().toISOString() as IsoDateTime;
    await repo.setSettings({ lastSyncAt: syncNow });

    // Update scheduler config
    schedulerConfig = {
      ...schedulerConfig,
      lastRun: syncNow,
      nextRun: new Date(Date.now() + icalFetchIntervalMinutes * 60 * 1000).toISOString() as IsoDateTime,
    };

    // Emit completion progress
    sendEventToRenderers('ical:progress', {
      stage: 'complete',
      progress: 100,
      message: `Auto-fetch: Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}`,
    });

    console.log(
      `[Scheduler] Auto-fetch complete: imported=${result.imported}, updated=${result.updated}, skipped=${result.skipped}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Scheduler] Auto-fetch failed:', error);

    // Update scheduler config with error
    schedulerConfig = {
      ...schedulerConfig,
      lastRun: new Date().toISOString() as IsoDateTime,
    };

    // Emit error progress
    sendEventToRenderers('ical:progress', {
      stage: 'error',
      progress: 100,
      message: `Auto-fetch failed: ${message}`,
    });

    // Emit scheduler error event
    sendEventToRenderers('scheduler:error', { message });

    // Log specific error types for debugging
    if (error instanceof NetworkError) {
      console.error('[Scheduler] Network error:', error.message);
    } else if (error instanceof HttpError) {
      console.error(`[Scheduler] HTTP error ${error.status}:`, error.message);
    } else if (error instanceof TimeoutError) {
      console.error('[Scheduler] Timeout error:', error.message);
    } else if (error instanceof ICalParseError) {
      console.error('[Scheduler] Parse error:', error.message);
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Starts or restarts the scheduler with the given settings.
 * Ensures only one interval is running at a time.
 *
 * @param settings - Current application settings
 */
export function startScheduler(settings: Settings): void {
  // Stop any existing scheduler
  stopScheduler();

  currentSettings = settings;

  const { autoFetchIcal, icalFetchIntervalMinutes } = settings;

  if (!autoFetchIcal || icalFetchIntervalMinutes <= 0) {
    console.log('[Scheduler] Auto-fetch disabled, not starting scheduler');
    schedulerConfig = {
      ...schedulerConfig,
      enabled: false,
      intervalMinutes: icalFetchIntervalMinutes,
    };
    return;
  }

  const intervalMs = icalFetchIntervalMinutes * 60 * 1000;
  console.log(`[Scheduler] Starting auto-fetch scheduler (interval: ${icalFetchIntervalMinutes} min)`);

  schedulerConfig = {
    enabled: true,
    intervalMinutes: icalFetchIntervalMinutes,
    lastRun: schedulerConfig.lastRun,
    nextRun: new Date(Date.now() + intervalMs).toISOString() as IsoDateTime,
  };

  // Run immediately on start
  runFetchCycle();

  // Set up recurring interval
  intervalId = setInterval(runFetchCycle, intervalMs);

  // Prevent interval from keeping process alive
  if (intervalId.unref) {
    intervalId.unref();
  }
}

/**
 * Starts the scheduler for testing purposes (uses current settings).
 */
export function startSchedulerForTesting(): void {
  if (currentSettings) {
    startScheduler(currentSettings);
  }
}

/**
 * Stops the scheduler and clears the interval.
 * Safe to call multiple times.
 */
export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Scheduler] Stopped auto-fetch scheduler');
  }
  schedulerConfig = {
    ...schedulerConfig,
    enabled: false,
    nextRun: null,
  };
}

/**
 * Gets the current scheduler configuration.
 */
export function getSchedulerConfig(): SchedulerConfig {
  return { ...schedulerConfig };
}

/**
 * Updates the scheduler configuration.
 */
export function setSchedulerConfig(partial: Partial<SchedulerConfig>): SchedulerConfig {
  schedulerConfig = { ...schedulerConfig, ...partial };
  
  // If enabled changed and we have settings, restart scheduler
  if (partial.enabled !== undefined && currentSettings) {
    if (partial.enabled) {
      startScheduler(currentSettings);
    } else {
      stopScheduler();
    }
  }
  
  // If interval changed and we have settings, restart scheduler
  if (partial.intervalMinutes !== undefined && currentSettings) {
    const updatedSettings = { ...currentSettings, icalFetchIntervalMinutes: partial.intervalMinutes };
    startScheduler(updatedSettings);
  }
  
  return schedulerConfig;
}

/**
 * Gets the current scheduler status.
 */
export function getSchedulerStatus(): SchedulerStatus {
  return {
    running: intervalId !== null,
    nextRun: schedulerConfig.nextRun,
    lastRun: schedulerConfig.lastRun,
    lastError: null, // TODO: Track last error
  };
}

/**
 * Updates the scheduler with new settings.
 * Restarts the interval if settings relevant to scheduling have changed.
 *
 * @param settings - New application settings
 */
export function updateScheduler(settings: Settings): void {
  const oldInterval = currentSettings?.icalFetchIntervalMinutes ?? 0;
  const newInterval = settings.icalFetchIntervalMinutes;
  const oldAutoFetch = currentSettings?.autoFetchIcal ?? false;
  const newAutoFetch = settings.autoFetchIcal;

  // Check if scheduling-relevant settings changed
  const intervalChanged = oldInterval !== newInterval;
  const autoFetchChanged = oldAutoFetch !== newAutoFetch;
  const urlChanged = currentSettings?.icalUrl !== settings.icalUrl;

  if (intervalChanged || autoFetchChanged || urlChanged) {
    console.log('[Scheduler] Settings changed, restarting scheduler');
    startScheduler(settings);
  } else {
    // Just update cached settings for the next cycle
    currentSettings = settings;
  }
}