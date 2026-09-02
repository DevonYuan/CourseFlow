/**
 * useIcalSync Hook — iCal Fetch/Import Logic
 *
 * Encapsulates the "Fetch Now" flow: fetch → parse → import with progress events.
 * Returns state and handlers for the Settings UI.
 *
 * @module @frontend/hooks/useIcalSync
 */
interface UseIcalSyncState {
    isLoading: boolean;
    progress: number;
    stage: 'fetch' | 'parse' | 'store' | 'idle';
    message: string | null;
    error: string | null;
    lastResult: {
        imported: number;
        updated: number;
        skipped: number;
    } | null;
}
interface UseIcalSyncReturn extends UseIcalSyncState {
    fetchAndImport: (url: string) => Promise<void>;
    reset: () => void;
}
/**
 * Custom hook for iCal sync operations.
 * Handles fetch → parse → import flow with progress updates via IPC events.
 */
export declare function useIcalSync(): UseIcalSyncReturn;
export {};
//# sourceMappingURL=useIcalSync.d.ts.map