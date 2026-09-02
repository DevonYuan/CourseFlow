/**
 * useSyncStatus Hook — Sync Status Logic
 *
 * Encapsulates sync status state and logic for the TopBar sync indicator.
 * Returns last sync time, next auto-sync time, syncing state, and sync trigger.
 *
 * @module @frontend/hooks/useSyncStatus
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIcalSync } from './useIcalSync';
import { useSettings } from './useSettings';
import { useToast } from '../context/ToastContext';
/**
 * Formats next sync time as relative countdown.
 * - <= 0: "due now"
 * - < 1 hour: "in Xm"
 * - < 24 hours: "in Xh"
 * - < 7 days: "in Xd"
 */
export function formatNextSync(isoString) {
    if (!isoString)
        return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (diffMs <= 0)
        return 'due now';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60)
        return `in ${diffMins}m`;
    if (diffHours < 24)
        return `in ${diffHours}h`;
    return `in ${diffDays}d`;
}
export function useSyncStatus() {
    const { settings } = useSettings();
    const { isLoading: isSyncing, progress, stage, lastResult, fetchAndImport, error } = useIcalSync();
    const { success: toastSuccess, error: toastError } = useToast();
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [nextAutoSyncAt, setNextAutoSyncAt] = useState(null);
    const [countdown, setCountdown] = useState('');
    // Timer ref for countdown updates (single interval, cleaned up on unmount)
    const timerRef = useRef(null);
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
        }
        else {
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
    const syncNow = useCallback(async () => {
        if (!settings?.icalUrl) {
            toastError('Please configure your iCal URL in Settings first');
            return;
        }
        try {
            await fetchAndImport(settings.icalUrl);
            // Show success toast with import details
            if (lastResult) {
                toastSuccess(`Synced: ${lastResult.imported} new, ${lastResult.updated} updated, ${lastResult.skipped} skipped`);
            }
        }
        catch {
            // Error toast is handled by useIcalSync's error state, but we add a fallback
            toastError(error || 'Sync failed. Please try again.');
        }
    }, [settings?.icalUrl, fetchAndImport, lastResult, error, toastSuccess, toastError]);
    const syncStatus = useMemo(() => {
        if (isSyncing)
            return 'syncing';
        if (lastResult)
            return 'success';
        return 'idle';
    }, [isSyncing, lastResult]);
    return {
        lastSyncAt,
        nextAutoSyncAt,
        countdown,
        isSyncing,
        progress,
        stage,
        syncNow,
        syncStatus,
    };
}
//# sourceMappingURL=useSyncStatus.js.map