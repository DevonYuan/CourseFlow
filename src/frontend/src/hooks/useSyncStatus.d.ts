/**
 * useSyncStatus Hook — Sync Status Logic
 *
 * Encapsulates sync status state and logic for the TopBar sync indicator.
 * Returns last sync time, next auto-sync time, syncing state, and sync trigger.
 *
 * @module @frontend/hooks/useSyncStatus
 */
interface UseSyncStatusReturn {
    /** ISO 8601 timestamp of last successful sync, or null if never synced */
    lastSyncAt: string | null;
    /** ISO 8601 timestamp of next scheduled auto-sync, or null if disabled */
    nextAutoSyncAt: string | null;
    /** Current countdown string (updates every minute) */
    countdown: string;
    /** Whether a sync operation is currently in progress */
    isSyncing: boolean;
    /** Current sync progress (0-100) */
    progress: number;
    /** Current sync stage */
    stage: 'fetch' | 'parse' | 'store' | 'idle';
    /** Trigger a manual sync now */
    syncNow: () => Promise<void>;
    /** Sync status for UI state */
    syncStatus: 'idle' | 'syncing' | 'success';
}
/**
 * Formats next sync time as relative countdown.
 * - <= 0: "due now"
 * - < 1 hour: "in Xm"
 * - < 24 hours: "in Xh"
 * - < 7 days: "in Xd"
 */
export declare function formatNextSync(isoString: string | null): string;
export declare function useSyncStatus(): UseSyncStatusReturn;
export {};
//# sourceMappingURL=useSyncStatus.d.ts.map