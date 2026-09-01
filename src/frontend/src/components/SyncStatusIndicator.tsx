/**
 * SyncStatusIndicator Component
 *
 * Displays sync status: last sync time, next auto-sync time,
 * and a manual sync button.
 *
 * @module @frontend/components/SyncStatusIndicator
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIcalSync } from '../hooks/useIcalSync';
import { useSettings } from '../hooks/useSettings';
import './SyncStatusIndicator.css';

interface SyncStatusIndicatorProps {
  /** Callback when manual sync is triggered */
  onSync?: () => void;
}

export function SyncStatusIndicator({ onSync }: SyncStatusIndicatorProps): JSX.Element {
  const { settings } = useSettings();
  const { isLoading: isSyncing, progress, stage, message, lastResult, fetchAndImport, reset } =
    useIcalSync();
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [nextAutoSyncAt, setNextAutoSyncAt] = useState<string | null>(null);

  // Load last sync time from settings
  useEffect(() => {
    if (settings?.lastSyncAt) {
      setLastSyncAt(settings.lastSyncAt);
    }
  }, [settings?.lastSyncAt]);

  // Calculate next auto-sync time
  useEffect(() => {
    if (settings?.autoFetchIcal && settings?.icalFetchIntervalMinutes) {
      const lastSync = settings.lastSyncAt ? new Date(settings.lastSyncAt) : new Date();
      const nextSync = new Date(lastSync.getTime() + settings.icalFetchIntervalMinutes * 60 * 1000);
      setNextAutoSyncAt(nextSync.toISOString());
    } else {
      setNextAutoSyncAt(null);
    }
  }, [settings?.autoFetchIcal, settings?.icalFetchIntervalMinutes, settings?.lastSyncAt]);

  // Format relative time (e.g., "2 hours ago", "just now")
  const formatRelativeTime = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, []);

  // Format next sync as relative (e.g., "in 2 hours", "in 30 minutes")
  const formatNextSync = useCallback((isoString: string): string => {
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
  }, []);

  const handleManualSync = useCallback(async () => {
    if (!settings?.icalUrl) return;
    await fetchAndImport(settings.icalUrl);
    onSync?.();
  }, [settings?.icalUrl, fetchAndImport, onSync]);

  const syncStatus = useMemo(() => {
    if (isSyncing) return 'syncing';
    if (lastResult) return 'success';
    return 'idle';
  }, [isSyncing, lastResult]);

  return (
    <div className="sync-status" aria-live="polite" aria-atomic="true">
      <div className="sync-status__info">
        {lastSyncAt && (
          <span className="sync-status__last" title={new Date(lastSyncAt).toLocaleString()}>
            <span className="sync-status__label">Last sync:</span>
            <span className="sync-status__value">{formatRelativeTime(lastSyncAt)}</span>
          </span>
        )}
        {nextAutoSyncAt && settings?.autoFetchIcal && (
          <span className="sync-status__next" title={new Date(nextAutoSyncAt).toLocaleString()}>
            <span className="sync-status__label">Next auto-sync:</span>
            <span className="sync-status__value">{formatNextSync(nextAutoSyncAt)}</span>
          </span>
        )}
        {!lastSyncAt && !settings?.autoFetchIcal && (
          <span className="sync-status__none">No sync yet</span>
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

      {message && <span className="sync-status__message">{message}</span>}
    </div>
  );
}