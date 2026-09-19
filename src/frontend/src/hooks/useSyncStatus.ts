/**
 * useSyncStatus Hook — Sync Status Logic
 *
 * Encapsulates sync status state and logic for the TopBar sync indicator.
 * Returns last sync time, next auto-sync time, syncing state, and sync trigger.
 * Supports multi-calendar: tracks per-source sync status.
 *
 * @module @frontend/hooks/useSyncStatus
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { useToast } from '../context/ToastContext';
import { useCalendarsStore } from '../stores/calendarsStore';

import { useIcalSync } from './useIcalSync';
import { useSettings } from './useSettings';

interface CalendarSyncStatus {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  isSyncing: boolean;
  progress: number;
  stage: 'fetch' | 'parse' | 'store' | 'idle';
}

interface UseSyncStatusReturn {
  /** ISO 8601 timestamp of last successful sync (global), or null if never synced */
  lastSyncAt: string | null;
  /** ISO 8601 timestamp of next scheduled auto-sync (global), or null if disabled */
  nextAutoSyncAt: string | null;
  /** Current countdown string (updates every minute) */
  countdown: string;
  /** Whether any sync operation is currently in progress */
  isSyncing: boolean;
  /** Current sync progress (0-100) - global */
  progress: number;
  /** Current sync stage - global */
  stage: 'fetch' | 'parse' | 'store' | 'idle';
  /** Trigger a manual sync now for all enabled calendars */
  syncNow: () => Promise<void>;
  /** Trigger a manual sync for a specific calendar source */
  syncSource: (sourceId: string) => Promise<void>;
  /** Sync status for UI state */
  syncStatus: 'idle' | 'syncing' | 'success';
  /** Per-calendar sync status */
  calendarSyncStatus: CalendarSyncStatus[];
}

/**
 * Formats next sync time as relative countdown.
 * - <= 0: "due now"
 * - < 1 hour: "in Xm"
 * - < 24 hours: "in Xh"
 * - < 7 days: "in Xd"
 */
export function formatNextSync(isoString: string | null): string {
  if (!isoString) return '';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return 'due now';
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  return `in ${diffDays}d`;
}

export function useSyncStatus(): UseSyncStatusReturn {
  const { settings } = useSettings();
  const enabledCalendars = useCalendarsStore(
    useShallow((state) => state.calendars.filter((c) => c.enabled)),
  );
  const {
    isLoading: isSyncing,
    progress,
    stage,
    lastResult,
    fetchAndImport,
    error,
  } = useIcalSync();
  const { success: toastSuccess, error: toastError } = useToast();
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [nextAutoSyncAt, setNextAutoSyncAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  // Per-calendar sync state
  const [calendarSyncStates, setCalendarSyncStates] = useState<Map<string, CalendarSyncStatus>>(new Map());

  // Timer ref for countdown updates (single interval, cleaned up on unmount)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load last sync time from settings (global fallback)
  useEffect(() => {
    if (settings?.lastSyncAt) {
      setLastSyncAt(settings.lastSyncAt);
    }
  }, [settings?.lastSyncAt]);

  // Initialize calendar sync states from calendars store
  useEffect(() => {
    setCalendarSyncStates((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const cal of enabledCalendars) {
        const hasCal = next.has(cal.id);
        if (hasCal === false) {
          next.set(cal.id, {
            id: cal.id,
            name: cal.name,
            color: cal.color,
            enabled: cal.enabled,
            lastSyncAt: cal.lastSyncAt,
            nextSyncAt: cal.nextSyncAt,
            lastError: cal.lastError,
            isSyncing: false,
            progress: 0,
            stage: 'idle',
          });
          changed = true;
        } else {
          // Update static properties
          const existing = next.get(cal.id)!;
          if (existing.name !== cal.name || existing.color !== cal.color || existing.enabled !== cal.enabled) {
            next.set(cal.id, {
              ...existing,
              name: cal.name,
              color: cal.color,
              enabled: cal.enabled,
              lastSyncAt: cal.lastSyncAt,
              nextSyncAt: cal.nextSyncAt,
              lastError: cal.lastError,
            });
            changed = true;
          }
        }
      }
      // Remove disabled calendars
      for (const [id] of next) {
        const isEnabled = enabledCalendars.some((c) => c.id === id);
        if (isEnabled === false) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [enabledCalendars]);

  // Subscribe to ical:progress events for per-source updates
  useEffect(() => {
    const unsubscribe = window.api.onIcalProgress?.((payload) => {
      if (payload.sourceId) {
        setCalendarSyncStates((prev) => {
          const next = new Map(prev);
          const existing = next.get(payload.sourceId!);
          if (existing) {
            next.set(payload.sourceId!, {
              ...existing,
              isSyncing: payload.stage !== 'complete' && payload.stage !== 'error',
              progress: payload.progress,
              stage: payload.stage === 'fetching' ? 'fetch' : payload.stage === 'parsing' ? 'parse' : payload.stage === 'importing' ? 'store' : 'idle',
            });
          }
          return next;
        });
      }
    });
    return () => unsubscribe?.();
  }, []);

  // Subscribe to scheduler:error events for per-source errors
  useEffect(() => {
    const unsubscribe = window.api.onSchedulerError?.((payload) => {
      if (payload.sourceId) {
        setCalendarSyncStates((prev) => {
          const next = new Map(prev);
          const existing = next.get(payload.sourceId!);
          if (existing) {
            next.set(payload.sourceId!, {
              ...existing,
              isSyncing: false,
              lastError: payload.message,
              stage: 'idle',
            });
          }
          return next;
        });
      }
    });
    return () => unsubscribe?.();
  }, []);

  // Calculate global next auto-sync time and start/stop countdown timer
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Find the earliest nextSyncAt among enabled calendars
    let earliestNextSync: Date | null = null;
    for (const cal of enabledCalendars) {
      if (cal.nextSyncAt) {
        const nextSync = new Date(cal.nextSyncAt);
        if (!earliestNextSync || nextSync < earliestNextSync) {
          earliestNextSync = nextSync;
        }
      }
    }

    if (earliestNextSync) {
      setNextAutoSyncAt(earliestNextSync.toISOString());

      // Update countdown every minute
      const updateCountdown = () => {
        setCountdown(formatNextSync(earliestNextSync.toISOString()));
      };
      updateCountdown(); // Initial update
      timerRef.current = setInterval(updateCountdown, 60_000);
    } else {
      setNextAutoSyncAt(null);
      setCountdown('');
    }

    // Cleanup on unmount or when settings change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabledCalendars]);

  const syncNow = useCallback(async () => {
    if (!settings?.icalUrl && enabledCalendars.length === 0) {
      toastError('Please configure at least one calendar in Settings first');
      return;
    }

    try {
      // For backward compatibility, if legacy icalUrl exists, use it
      if (settings?.icalUrl) {
        await fetchAndImport(settings.icalUrl);
      }
      // Trigger sync for all enabled calendars via scheduler
      for (const cal of enabledCalendars) {
        await window.api.scheduler.trigger?.(cal.id);
      }

      // Show success toast with import details
      if (lastResult) {
        toastSuccess(
          `Synced: ${lastResult.imported} new, ${lastResult.updated} updated, ${lastResult.skipped} skipped`,
        );
      }
    } catch {
      toastError(error || 'Sync failed. Please try again.');
    }
  }, [settings?.icalUrl, enabledCalendars, fetchAndImport, lastResult, error, toastSuccess, toastError]);

  const syncSource = useCallback(async (sourceId: string) => {
    const cal = enabledCalendars.find((c) => c.id === sourceId);
    if (!cal) return;

    try {
      await window.api.scheduler.trigger?.(sourceId);
    } catch {
      toastError(`Failed to sync ${cal.name}`);
    }
  }, [enabledCalendars, toastError]);

  const syncStatus = useMemo(() => {
    if (isSyncing) return 'syncing';
    if (lastResult) return 'success';
    return 'idle';
  }, [isSyncing, lastResult]);

  // Convert Map to array for easier rendering
  const calendarSyncStatusArray = useMemo(() => {
    return [...calendarSyncStates.values()].sort((a, b) => {
      const aCal = enabledCalendars.find((c) => c.id === a.id);
      const bCal = enabledCalendars.find((c) => c.id === b.id);
      return (aCal?.position ?? 999) - (bCal?.position ?? 999);
    });
  }, [calendarSyncStates, enabledCalendars]);

  return {
    lastSyncAt,
    nextAutoSyncAt,
    countdown,
    isSyncing,
    progress,
    stage,
    syncNow,
    syncSource,
    syncStatus,
    calendarSyncStatus: calendarSyncStatusArray,
  };
}
