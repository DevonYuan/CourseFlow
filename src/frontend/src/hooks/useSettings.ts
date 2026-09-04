/**
 * useSettings Hook — Settings Management
 *
 * Fetches settings from the backend via IPC, handles loading/error states,
 * and provides update functionality. Subscribes to settings:changed events
 * to auto-refresh when settings are modified externally.
 *
 * @module @frontend/hooks/useSettings
 */

import type { IpcResult } from '@backend/shared/ipc';
import type { Settings } from '@backend/shared/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Type-safe access to window.api
 
const api = window.api;
 

/**
 * Custom hook for managing settings state.
 * Uses memoized selectors to prevent unnecessary re-renders.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
       
      const result: IpcResult<Settings> = await api.settings.get();
      if (result.ok) {
        setSettings(result.data);
      } else {
        setError(result.error);
      }
       
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Listen for external settings changes
  useEffect(() => {
     
    const unsubscribe = api.onSettingsChanged((newSettings: Settings) => {
      setSettings(newSettings);
    });
     
    return unsubscribe;
  }, []);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    setError(null);
    try {
       
      const result: IpcResult<Settings> = await api.settings.set(partial);
      if (!result.ok) {
        setError(result.error);
      }
       
      // The onSettingsChanged event will update the state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  }, []);

  const refetch = useCallback(() => loadSettings(), [loadSettings]);
  const clearError = useCallback(() => setError(null), []);

  // Memoize return value to prevent unnecessary re-renders
  const memoized = useMemo(
    () => ({
      settings,
      isLoading,
       
      error,
      updateSettings,
      refetch,
      clearError,
    }),
    [settings, isLoading, error, updateSettings, refetch, clearError],
  );
  return memoized;
}