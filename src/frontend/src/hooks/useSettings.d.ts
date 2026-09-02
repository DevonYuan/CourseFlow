/**
 * useSettings Hook — Settings Management
 *
 * Fetches settings from the backend via IPC, handles loading/error states,
 * and provides update functionality. Subscribes to settings:changed events
 * to auto-refresh when settings are modified externally.
 *
 * @module @frontend/hooks/useSettings
 */
import type { Settings } from '@backend/shared/types';
/**
 * Custom hook for managing settings state.
 * Uses memoized selectors to prevent unnecessary re-renders.
 */
export declare function useSettings(): {
    settings: Settings | null;
    isLoading: boolean;
    error: string | null;
    updateSettings: (partial: Partial<Settings>) => Promise<void>;
    refetch: () => Promise<void>;
    clearError: () => void;
};
//# sourceMappingURL=useSettings.d.ts.map