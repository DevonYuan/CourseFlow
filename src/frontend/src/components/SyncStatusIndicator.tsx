/**
 * SyncStatusIndicator Component
 *
 * Displays sync status: last sync time, next auto-sync time,
 * and a manual sync button.
 * Supports compact mode for the TopBar (sync pill).
 * Matches: docs/design-inspo/courseflow-dashbar-redesign.html
 *
 * @module @frontend/components/SyncStatusIndicator
 */

import { useMemo } from 'react';

import { useSyncStatus, formatNextSync } from '../hooks/useSyncStatus';
import './SyncStatusIndicator.css';

interface SyncStatusIndicatorProps {
  /** Callback when manual sync is triggered */
  onSync?: () => void;
  /** Compact mode for TopBar - shows as a pill with label/value and sync button */
  compact?: boolean;
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
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

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

export function SyncStatusIndicator({
  onSync,
  compact = false,
}: SyncStatusIndicatorProps): JSX.Element {
  const { lastSyncAt, nextAutoSyncAt, countdown, isSyncing, progress, syncStatus, syncNow } =
    useSyncStatus();

  // Determine display text for last sync
  const lastSyncDisplay = useMemo(() => formatLastSync(lastSyncAt), [lastSyncAt]);

  // Use countdown state for real-time updates, fallback to calculated value
  const nextSyncDisplay = countdown || (nextAutoSyncAt ? formatNextSync(nextAutoSyncAt) : '');

  const handleSyncNow = () => {
    syncNow().then(() => {
      onSync?.();
    });
  };

  // Compact mode - Sync Pill for TopBar
  if (compact) {
    const label = isSyncing ? 'Syncing…' : `Synced ${lastSyncDisplay}`;
    const value = isSyncing
      ? `${progress}%`
      : nextSyncDisplay
        ? `Next in ${nextSyncDisplay}`
        : 'No auto-sync';

    return (
      <div
        className="sync-pill"
        aria-live="polite"
        aria-atomic="true"
        data-testid="scheduler-status-compact"
      >
        <div className="sync-text">
          <span className="label">{label}</span>
          <span className="value">{value}</span>
        </div>
        <button
          className="sync-btn"
          onClick={handleSyncNow}
          disabled={isSyncing}
          aria-label={isSyncing ? 'Sync in progress' : 'Sync now'}
          aria-busy={isSyncing}
        >
          {isSyncing ? (
            <svg
              className="sync-spinner"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Full mode - for Settings page or other uses
  return (
    <div
      className="sync-status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="scheduler-status"
    >
      <div className="sync-status__info">
        <span
          className="sync-status__last"
          title={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : ''}
        >
          <span className="sync-status__label">Last sync:</span>
          <span className="sync-status__value">{lastSyncDisplay}</span>
        </span>
        {nextAutoSyncAt && (
          <span
            className="sync-status__next"
            title={nextAutoSyncAt ? new Date(nextAutoSyncAt).toLocaleString() : ''}
          >
            <span className="sync-status__label">Next auto-sync:</span>
            <span className="sync-status__value">{nextSyncDisplay}</span>
          </span>
        )}
      </div>

      <button
        className={`sync-status__btn sync-status__btn--${syncStatus}`}
        onClick={handleSyncNow}
        disabled={isSyncing}
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
