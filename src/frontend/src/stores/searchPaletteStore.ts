/**
 * Search Palette Store — Zustand
 *
 * Global visibility state for the command-palette style search overlay.
 * Split into its own tiny store so the palette can be opened from anywhere
 * (global Cmd+K / Ctrl+K shortcut, Notes sidebar "Search" button, etc.)
 * without coupling the notes tree store to the search UI.
 *
 * @module @frontend/stores/searchPalette
 */

import { create } from 'zustand';

interface SearchPaletteState {
  /** Whether the search overlay is currently open */
  isOpen: boolean;
  /** Open the search overlay */
  open: () => void;
  /** Close the search overlay */
  close: () => void;
  /** Toggle the search overlay */
  toggle: () => void;
}

export const useSearchPaletteStore = create<SearchPaletteState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

/** Selector for the open-boolean only. */
export const selectSearchPaletteOpen = (s: SearchPaletteState): boolean => s.isOpen;