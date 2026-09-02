import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * SyncStatusIndicator Component
 *
 * Displays sync status: last sync time, next auto-sync time,
 * and a manual sync button.
 *
 * @module @frontend/components/SyncStatusIndicator
 */
import { useMemo } from 'react';
import { useSyncStatus, formatNextSync } from '../hooks/useSyncStatus';
import './SyncStatusIndicator.css';
/**
 * Formats a date as relative time for recent (< 1 hour) or absolute for older.
 * - < 1 minute: "just now"
 * - < 1 hour: "Xm ago"
 * - < 24 hours: "Xh ago"
 * - < 7 days: "Xd ago"
 * - Older: "Jan 15, 2:30 PM" (locale-aware)
 */
function formatLastSync(isoString) {
    if (!isoString)
        return 'Never synced';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1)
        return 'just now';
    if (diffMins < 60)
        return `${diffMins}m ago`;
    if (diffHours < 24)
        return `${diffHours}h ago`;
    if (diffDays < 7)
        return `${diffDays}d ago`;
    // Absolute format for older dates
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}
export function SyncStatusIndicator({ onSync }) {
    const { lastSyncAt, nextAutoSyncAt, countdown, isSyncing, progress, syncStatus, syncNow, } = useSyncStatus();
    // Determine display text for last sync
    const lastSyncDisplay = useMemo(() => formatLastSync(lastSyncAt), [lastSyncAt]);
    // Use countdown state for real-time updates, fallback to calculated value
    const nextSyncDisplay = countdown || (nextAutoSyncAt ? formatNextSync(nextAutoSyncAt) : '');
    const handleSyncNow = () => {
        syncNow().then(() => {
            onSync?.();
        });
    };
    return (_jsxs("div", { className: "sync-status", "aria-live": "polite", "aria-atomic": "true", children: [_jsxs("div", { className: "sync-status__info", children: [_jsxs("span", { className: "sync-status__last", title: lastSyncAt ? new Date(lastSyncAt).toLocaleString() : '', children: [_jsx("span", { className: "sync-status__label", children: "Last sync:" }), _jsx("span", { className: "sync-status__value", children: lastSyncDisplay })] }), nextAutoSyncAt && (_jsxs("span", { className: "sync-status__next", title: nextAutoSyncAt ? new Date(nextAutoSyncAt).toLocaleString() : '', children: [_jsx("span", { className: "sync-status__label", children: "Next auto-sync:" }), _jsx("span", { className: "sync-status__value", children: nextSyncDisplay })] }))] }), _jsx("button", { className: `sync-status__btn sync-status__btn--${syncStatus}`, onClick: handleSyncNow, disabled: isSyncing, "aria-label": isSyncing ? 'Sync in progress' : 'Sync now', "aria-busy": isSyncing, children: isSyncing ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "sync-status__spinner", "aria-hidden": "true" }), _jsxs("span", { className: "sync-status__btn-text", children: ["Syncing... ", progress, "%"] })] })) : ('Sync Now') })] }));
}
//# sourceMappingURL=SyncStatusIndicator.js.map