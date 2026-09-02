/**
 * useIcalSync Hook — iCal Fetch/Import Logic
 *
 * Encapsulates the "Fetch Now" flow: fetch → parse → import with progress events.
 * Returns state and handlers for the Settings UI.
 *
 * @module @frontend/hooks/useIcalSync
 */
import { useState, useCallback, useEffect, useRef } from 'react';
/**
 * Custom hook for iCal sync operations.
 * Handles fetch → parse → import flow with progress updates via IPC events.
 */
export function useIcalSync() {
    const [state, setState] = useState({
        isLoading: false,
        progress: 0,
        stage: 'idle',
        message: null,
        error: null,
        lastResult: null,
    });
    const abortControllerRef = useRef(null);
    const progressUnsubscribeRef = useRef(null);
    // Subscribe to ical:progress events from main process
    useEffect(() => {
        const unsubscribe = window.api.onIcalProgress((payload) => {
            setState((prev) => ({
                ...prev,
                progress: payload.progress,
                stage: payload.stage,
                message: payload.message ?? null,
            }));
        });
        progressUnsubscribeRef.current = unsubscribe;
        return () => {
            progressUnsubscribeRef.current?.();
        };
    }, []);
    const reset = useCallback(() => {
        setState({
            isLoading: false,
            progress: 0,
            stage: 'idle',
            message: null,
            error: null,
            lastResult: null,
        });
    }, []);
    const fetchAndImport = useCallback(async (url) => {
        // Validate URL
        if (!url || typeof url !== 'string') {
            setState((prev) => ({ ...prev, error: 'URL is required' }));
            return;
        }
        try {
            new URL(url);
        }
        catch {
            setState((prev) => ({ ...prev, error: 'Invalid URL format' }));
            return;
        }
        // Abort any previous operation
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        setState((prev) => ({
            ...prev,
            isLoading: true,
            progress: 0,
            stage: 'fetch',
            error: null,
            message: 'Starting fetch...',
            lastResult: null,
        }));
        try {
            // Step 1: Fetch iCal feed
            const fetchResult = await window.api.ical.fetch(url);
            if (!fetchResult.ok) {
                throw new Error(fetchResult.error);
            }
            const events = fetchResult.data;
            if (events.length === 0) {
                setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    stage: 'idle',
                    message: 'No events found in iCal feed',
                }));
                return;
            }
            // Step 2: Import events
            setState((prev) => ({
                ...prev,
                stage: 'store',
                message: `Importing ${events.length} events...`,
            }));
            const importResult = await window.api.ical.import({ events, sourceUrl: url });
            if (!importResult.ok) {
                throw new Error(importResult.error);
            }
            // Success
            setState((prev) => ({
                ...prev,
                isLoading: false,
                progress: 100,
                stage: 'idle',
                message: `Successfully imported: ${importResult.data.imported} new, ${importResult.data.updated} updated, ${importResult.data.skipped} skipped`,
                lastResult: importResult.data,
            }));
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setState((prev) => ({
                ...prev,
                isLoading: false,
                progress: 0,
                stage: 'idle',
                error: errorMessage,
                message: null,
            }));
        }
    }, []);
    return {
        ...state,
        fetchAndImport,
        reset,
    };
}
//# sourceMappingURL=useIcalSync.js.map