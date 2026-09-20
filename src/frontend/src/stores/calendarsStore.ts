/**
 * Calendars Store — Zustand
 *
 * Centralized state management for calendar sources (multi-calendar support).
 * Handles fetching, caching, and real-time updates via db:changed events.
 * Supports optimistic updates with rollback on IPC errors.
 *
 * @module @frontend/stores/calendarsStore
 */

import type { IpcEvents } from '@backend/shared/ipc';
import type { CalendarSource, CalendarSourceInput, CalendarSourceUpdateInput, EntityId, IsoDateTime } from '@backend/shared/types';
import { create } from 'zustand';

/**
 * Calendar state for the store.
 */
interface CalendarsState {
  /** Current list of calendar sources ordered by position */
  calendars: CalendarSource[];
  /** Whether a fetch operation is in progress */
  isLoading: boolean;
  /**
   * Whether an initial load has completed (successfully or not).
   * Distinguishes "not loaded yet" from "loaded, but empty" so consumers
   * do not re-fetch forever when there are zero calendars.
   */
  hasFetched: boolean;
  /** Error message if fetch failed (null if no error) */
  error: string | null;
  /** Previous calendar order for rollback on reorder error */
  _previousCalendars: CalendarSource[] | null;
  /** Previous state for optimistic update rollback */
  _previousState: CalendarsState | null;
}

interface CalendarsActions {
  /** Triggers a fresh fetch of calendar sources from the database */
  fetchCalendars: () => Promise<void>;
  /** Hydrates store with calendars (used on app startup) */
  hydrate: (calendars: CalendarSource[]) => void;
  /** Sets calendars directly (used for initial load or external updates) */
  setCalendars: (calendars: CalendarSource[]) => void;
  /** Optimistically creates a new calendar */
  optimisticCreate: (input: CalendarSourceInput) => Promise<void>;
  /** Optimistically updates a calendar */
  optimisticUpdate: (input: CalendarSourceUpdateInput) => Promise<void>;
  /** Optimistically deletes a calendar (soft-delete: sets enabled=false) */
  optimisticDelete: (id: EntityId) => Promise<void>;
  /** Optimistically reorders calendars */
  optimisticReorder: (orderedIds: EntityId[]) => void;
  /** Reverts to previous calendar order (rollback on IPC error) */
  revertCalendars: () => void;
  /** Reverts optimistic update on IPC error */
  revertUpdate: () => void;
  /** Handles db:changed event payload for calendars table */
  handleDbChanged: (payload: IpcEvents['db:changed']) => void;
  /** Clears the current error state */
  clearError: () => void;
  /** Set enabled state optimistically */
  setEnabledOptimistic: (id: EntityId, enabled: boolean) => Promise<void>;
}

/**
 * Generate a temporary ID for optimistic creation.
 */
function generateTempId(): EntityId {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}` as EntityId;
}

/**
 * Generate a deterministic color from a name (matching backend logic).
 */
function generateColorFromName(name: string): string {
  const colors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#8b5cf6',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.codePointAt(i)! + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

/**
 * Determine the next position (append to end).
 */
function getNextPosition(calendars: CalendarSource[]): number {
  let maxPos = -1;
  for (const cal of calendars) {
    if (cal.position > maxPos) maxPos = cal.position;
  }
  return maxPos + 1;
}

export const useCalendarsStore = create<CalendarsState & CalendarsActions>((set, get) => ({
  calendars: [],
  isLoading: false,
  hasFetched: false,
  error: null,
  _previousCalendars: null,
  _previousState: null,

  fetchCalendars: async () => {
    // De-duplicate concurrent requests (e.g. app startup + a component mount).
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const result = await window.api.db.calendars.list();
      if (result.ok) {
        set({ calendars: result.data, isLoading: false, hasFetched: true });
      } else {
        set({ error: result.error, isLoading: false, hasFetched: true });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load calendars';
      set({ error: errorMessage, isLoading: false, hasFetched: true });
    }
  },

  hydrate: (calendars: CalendarSource[]) => {
    set({ calendars, isLoading: false, hasFetched: true, error: null });
  },

  setCalendars: (calendars: CalendarSource[]) => {
    set({ calendars, isLoading: false, hasFetched: true, error: null });
  },

  optimisticCreate: async (input: CalendarSourceInput) => {
    const { calendars } = get();
    const tempId = generateTempId();
    const now = new Date().toISOString() as IsoDateTime;

    // Create optimistic calendar
    const optimisticCalendar: CalendarSource = {
      id: tempId,
      name: input.name,
      feedUrl: '', // Will be filled by backend after encryption
      enabled: input.enabled ?? true,
      color: input.color ?? generateColorFromName(input.name),
      position: input.position ?? getNextPosition(calendars),
      lastSyncAt: null,
      nextSyncAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };

    // Save previous state for rollback
    const previousState = { ...get() };
    set({
      calendars: [...calendars, optimisticCalendar].sort((a, b) => a.position - b.position),
      _previousState: previousState,
    });

    try {
      const result = await window.api.db.calendars.create(input);
      if (!result.ok) {
        // Rollback on error
        set({ ...previousState, error: result.error });
        return;
      }
      // Replace temp calendar with real one
      set((state) => ({
        calendars: state.calendars.map((cal) =>
          cal.id === tempId ? result.data : cal
        ),
        _previousState: null,
      }));
    } catch (err) {
      // Rollback on network error
      set({ ...previousState, error: err instanceof Error ? err.message : 'Failed to create calendar' });
    }
  },

  optimisticUpdate: async (input: CalendarSourceUpdateInput) => {
    const { calendars } = get();
    const existing = calendars.find((c) => c.id === input.id);
    if (!existing) return;

    // Save previous state for rollback
    const previousState = { ...get() };

    // Apply optimistic update
    const optimisticCalendar: CalendarSource = {
      ...existing,
      ...input,
      // feedUrl and color are already proper types
      feedUrl: input.feedUrl ?? existing.feedUrl,
      color: input.color ?? existing.color,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    set({
      calendars: calendars.map((cal) =>
        cal.id === input.id ? optimisticCalendar : cal
      ).sort((a, b) => a.position - b.position),
      _previousState: previousState,
    });

    try {
      const result = await window.api.db.calendars.update(input);
      if (!result.ok) {
        set({ ...previousState, error: result.error });
      }
    } catch (err) {
      set({ ...previousState, error: err instanceof Error ? err.message : 'Failed to update calendar' });
    }
  },

  optimisticDelete: async (id: EntityId) => {
    const { calendars } = get();
    const existing = calendars.find((c) => c.id === id);
    if (!existing) return;

    // Save previous state for rollback
    const previousState = { ...get() };

    // Soft-delete: set enabled to false
    const optimisticCalendar: CalendarSource = {
      ...existing,
      enabled: false,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    set({
      calendars: calendars.map((cal) =>
        cal.id === id ? optimisticCalendar : cal
      ),
      _previousState: previousState,
    });

    try {
      const result = await window.api.db.calendars.delete(id);
      if (!result.ok) {
        set({ ...previousState, error: result.error });
      }
    } catch (err) {
      set({ ...previousState, error: err instanceof Error ? err.message : 'Failed to delete calendar' });
    }
  },

  optimisticReorder: (orderedIds: EntityId[]) => {
    const { calendars } = get();
    const previousCalendars = [...calendars];

    // Create a map for quick lookup
    const calendarMap = new Map(calendars.map((c) => [c.id, c]));

    // Reorder based on the new order
    const reorderedCalendars = orderedIds
      .map((id, index) => {
        const cal = calendarMap.get(id);
        return cal ? { ...cal, position: index, updatedAt: new Date().toISOString() } : null;
      })
      .filter((cal): cal is CalendarSource => cal !== null);

    set({
      calendars: reorderedCalendars,
      _previousCalendars: previousCalendars,
    });

    // Fire and forget IPC call
    window.api.db.calendars.reorder(orderedIds).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reorder calendars';
      set({ calendars: previousCalendars, _previousCalendars: null, error: errorMessage });
    });
  },

  revertCalendars: () => {
    const { _previousCalendars } = get();
    if (_previousCalendars) {
      set({ calendars: _previousCalendars, _previousCalendars: null });
    }
  },

  revertUpdate: () => {
    const { _previousState } = get();
    if (_previousState) {
      set({ ..._previousState, _previousState: null });
    }
  },

  handleDbChanged: (payload: IpcEvents['db:changed']) => {
    if (payload.table !== 'calendars') return;

    switch (payload.action) {
      case 'insert': {
        // Fetch the inserted calendar to get the real (decrypted) data.
        // Upsert by id rather than append: `optimisticCreate` already added a
        // temp row that it later swaps for the real one, and this event can
        // arrive before or after that swap — appending would duplicate the row.
        void window.api.db.calendars.get(payload.id).then((result) => {
          if (result.ok && result.data) {
            const inserted = result.data;
            set((state) => {
              const exists = state.calendars.some((cal) => cal.id === inserted.id);
              const calendars = exists
                ? state.calendars.map((cal) => (cal.id === inserted.id ? inserted : cal))
                : [...state.calendars, inserted];
              return { calendars: calendars.sort((a, b) => a.position - b.position) };
            });
          }
        });
        break;
      }
      case 'update': {
        // For update, fetch the updated calendar
        void window.api.db.calendars.get(payload.id).then((result) => {
          if (result.ok && result.data) {
            set((state) => ({
              calendars: state.calendars.map((cal) =>
                cal.id === payload.id ? result.data! : cal
              ).sort((a, b) => a.position - b.position),
            }));
          }
        });
        break;
      }
      case 'delete': {
        // For delete, remove from list (soft delete already happened optimistically)
        set((state) => ({
          calendars: state.calendars.filter((cal) => cal.id !== payload.id),
        }));
        break;
      }
      case 'reorder': {
        // Reorder event from another window - re-fetch to get correct order
        void window.api.db.calendars.list().then((result) => {
          if (result.ok) {
            set({ calendars: result.data });
          }
        });
        break;
      }
    }
  },

  clearError: () => {
    set({ error: null });
  },

  setEnabledOptimistic: async (id: EntityId, enabled: boolean) => {
    const { calendars } = get();
    const existing = calendars.find((c) => c.id === id);
    if (!existing) return;

    const previousState = { ...get() };

    const optimisticCalendar: CalendarSource = {
      ...existing,
      enabled,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    set({
      calendars: calendars.map((cal) =>
        cal.id === id ? optimisticCalendar : cal
      ),
      _previousState: previousState,
    });

    try {
      const result = await window.api.db.calendars.setEnabled({ id, enabled });
      if (!result.ok) {
        set({ ...previousState, error: result.error });
      }
    } catch (err) {
      set({ ...previousState, error: err instanceof Error ? err.message : 'Failed to update calendar' });
    }
  },
}));

/**
 * Selector for getting calendars sorted by position.
 */
export function selectCalendarsByPosition(): CalendarSource[] {
  return [...useCalendarsStore.getState().calendars].sort((a, b) => a.position - b.position);
}

/**
 * Initialize the calendars store — fetches calendar sources from the database.
 * Returns cleanup function (currently no-op, kept for API compatibility).
 */
export function initializeCalendarsStore(): () => void {
  const store = useCalendarsStore.getState();
  void store.fetchCalendars();
  return () => {};
}

// Named export only - default export not used per project conventions