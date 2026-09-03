/**
 * Auto-Fetch Scheduler — Main Process
 *
 * Periodically fetches and imports iCal data based on user settings.
 * Runs in the Electron main process using setInterval.
 *
 * @module @backend/main/scheduler
 */

import type { Settings, IsoDateTime } from '../shared/types.js';
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
    const now = new Date().toISOString() as IsoDateTime;
    await repo.setSettings({ lastSyncAt: now });

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

    // Emit error progress
    sendEventToRenderers('ical:progress', {
      stage: 'error',
      progress: 100,
      message: `Auto-fetch failed: ${message}`,
    });

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
    return;
  }

  const intervalMs = icalFetchIntervalMinutes * 60 * 1000;
  console.log(`[Scheduler] Starting auto-fetch scheduler (interval: ${icalFetchIntervalMinutes} min)`);

  // Run immediately on start (optional - could be disabled if not desired)
  // Comment out the next line if you don't want an immediate fetch on startup
  runFetchCycle();

  // Set up recurring interval
  intervalId = setInterval(runFetchCycle, intervalMs);

  // Prevent interval from keeping process alive (not needed in Electron main, but good practice)
  if (intervalId.unref) {
    intervalId.unref();
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

/**
 * Gets the current scheduler status for debugging.
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  intervalId: boolean;
  settings: Settings | null;
} {
  return {
    isRunning,
    intervalId: intervalId !== null,
    settings: currentSettings,
  };
}