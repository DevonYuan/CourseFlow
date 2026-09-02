/**
 * SyncStatusIndicator Component
 *
 * Displays sync status: last sync time, next auto-sync time,
 * and a manual sync button.
 *
 * @module @frontend/components/SyncStatusIndicator
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIcalSync } from '../hooks/useIcalSync';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../context/ToastContext';
import './SyncStatusIndicator.css';

interface SyncStatusIndicatorProps {
  /** Callback when manual sync is triggered */
  onSync?: () => void;
}

/**
 * Formats a date as relative time for recent (< 1 hour) or absolute for older.
 * - < 1 minute: "just now"
 * - < 1 hour: "Xm ago"
 * - < 24 hours: "Xh ago"
 * - < 7 days: "Xd ago"
 * - Older: "Jan 15, 2:30 PM" (locale-aware)
 */
function formatLastSync(isoString: string | null): string {
  if (!isoString) return 'Never synced';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Absolute format for older dates
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats next sync time as relative countdown.
 * - <= 0: "due now"
 * - < 1 hour: "in Xm"
 * - < 24 hours: "in Xh"
 * - < 7 days: "in Xd"
 */
function formatNextSync(isoString: string | null): string {
  if (!isoString) return '';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return 'due now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  return `in ${diffDays}d`;
}

export function SyncStatusIndicator({ onSync }: SyncStatusIndicatorProps): JSX.Element {
  const { settings } = useSettings();
  const { isLoading: isSyncing, progress, stage, message, lastResult, fetchAndImport, error } =
    useIcalSync();
  const { success: toastSuccess, error: toastError } = useToast();
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [nextAutoSyncAt, setNextAutoSyncAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  // Timer ref for countdown updates (single interval, cleaned up on unmount)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load last sync time from settings
  useEffect(() => {
    if (settings?.lastSyncAt) {
      setLastSyncAt(settings.lastSyncAt);
    }
  }, [settings?.lastSyncAt]);

  // Calculate next auto-sync time and start/stop countdown timer
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (settings?.autoFetchIcal && settings?.icalFetchIntervalMinutes && settings?.lastSyncAt) {
      const lastSync = new Date(settings.lastSyncAt);
      const nextSync = new Date(lastSync.getTime() + settings.icalFetchIntervalMinutes * 60 * 1000);
      setNextAutoSyncAt(nextSync.toISOString());

      // Update countdown every minute
      const updateCountdown = () => {
        setCountdown(formatNextSync(nextSync.toISOString()));
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
  }, [settings?.autoFetchIcal, settings?.icalFetchIntervalMinutes, settings?.lastSyncAt]);

  const handleManualSync = useCallback(async () => {
    if (!settings?.icalUrl) {
      toastError('Please configure your iCal URL in Settings first');
      return;
    }

    try {
      await fetchAndImport(settings.icalUrl);

      // Show success toast with import details
      if (lastResult) {
        toastSuccess(
          `Synced: ${lastResult.imported} new, ${lastResult.updated} updated, ${lastResult.skipped} skipped`,
        );
      }

      onSync?.();
    } catch {
      // Error toast is handled by useIcalSync's error state, but we add a fallback
      toastError(error || 'Sync failed. Please try again.');
    }
  }, [settings?.icalUrl, fetchAndImport, onSync, lastResult, error, toastSuccess, toastError]);

  const syncStatus = useMemo(() => {
    if (isSyncing) return 'syncing';
    if (lastResult) return 'success';
    return 'idle';
  }, [isSyncing, lastResult]);

  // Determine display text for last sync
  const lastSyncDisplay = useMemo(() => formatLastSync(lastSyncAt), [lastSyncAt]);

  // Use countdown state for real-time updates, fallback to calculated value
  const nextSyncDisplay = countdown || formatNextSync(nextAutoSyncAt);

  return (
    <div className="sync-status" aria-live="polite" aria-atomic="true">
      <div className="sync-status__info">
        <span className="sync-status__last" title={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : ''}>
          <span className="sync-status__label">Last sync:</span>
          <span className="sync-status__value">{lastSyncDisplay}</span>
        </span>
        {settings?.autoFetchIcal && settings?.icalFetchIntervalMinutes && settings?.lastSyncAt && (
          <span className="sync-status__next" title={nextAutoSyncAt ? new Date(nextAutoSyncAt).toLocaleString() : ''}>
            <span className="sync-status__label">Next auto-sync:</span>
            <span className="sync-status__value">{nextSyncDisplay}</span>
          </span>
        )}
      </div>

      <button
        className={`sync-status__btn sync-status__btn--${syncStatus}`}
        onClick={handleManualSync}
        disabled={isSyncing || !settings?.icalUrl}
        aria-label={isSyncing ? 'Sync in progress' : 'Sync now'}
        aria-busy={isSyncing}
      >
        {isSyncing ? (
          <>
            <span className="sync-status__spinner" aria-hidden="true" />
            <span className="sync-status__btn-text">Syncing... {progress}%</span>
          </>
        ) : (
          'Sync Now'
        )}
      </button>
    </div>
  );
}