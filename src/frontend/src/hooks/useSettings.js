/**
 * useSettings Hook — Settings Management
 *
 * Fetches settings from the backend via IPC, handles loading/error states,
 * and provides update functionality. Subscribes to settings:changed events
 * to auto-refresh when settings are modified externally.
 *
 * @module @frontend/hooks/useSettings
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
// Type-safe access to window.api
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const api = window.api;
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
/**
 * Custom hook for managing settings state.
 * Uses memoized selectors to prevent unnecessary re-renders.
 */
export function useSettings() {
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
            const result = await api.settings.get();
            if (result.ok) {
                setSettings(result.data);
            }
            else {
                setError(result.error);
            }
            /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load settings');
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    // Initial load
    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);
    // Listen for external settings changes
    useEffect(() => {
        /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
        const unsubscribe = api.onSettingsChanged((newSettings) => {
            setSettings(newSettings);
        });
        /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
        return unsubscribe;
    }, []);
    const updateSettings = useCallback(async (partial) => {
        setError(null);
        try {
            /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
            const result = await api.settings.set(partial);
            if (!result.ok) {
                setError(result.error);
            }
            /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
            // The onSettingsChanged event will update the state
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update settings');
        }
    }, []);
    const refetch = useCallback(() => loadSettings(), [loadSettings]);
    const clearError = useCallback(() => setError(null), []);
    // Memoize return value to prevent unnecessary re-renders
    const memoized = useMemo(() => ({
        settings,
        isLoading,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        error,
        updateSettings,
        refetch,
        clearError,
    }), [settings, isLoading, error, updateSettings, refetch, clearError]);
    return memoized;
}
//# sourceMappingURL=useSettings.js.map