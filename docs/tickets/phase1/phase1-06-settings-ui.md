# Ticket: phase1-06-settings-ui

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 1 day

---

## Description

Build a Settings page/modal in React: input for iCal URL, "Fetch Now" button, auto-fetch interval dropdown, theme selector. Accessible via gear icon in top bar (ticket 1.13).

**PREREQUISITE**: Ticket 1.0 (Data Model Alignment) extends `Settings` type with `icalUrl`, `lastSyncAt`, `autoFetchIntervalMs`.

---

## Requirements

### Functional

- [ ] **Settings Modal/Page** — Triggered by gear icon in top bar
- [ ] **iCal URL Input** — Text field with placeholder "https://canvas.institution.edu/feeds/calendars/..."
  - Shows current URL (decrypted) if set
  - Validation: must be valid URL, shows error inline
- [ ] **Fetch Now Button** — Calls `window.api.ical.fetch(url)` → shows progress (via `ical:progress` events) → on success, calls `window.api.ical.import(events, url)` → shows toast with import counts
  - Disabled while fetch/import in progress
  - Shows spinner during operation
- [ ] **Auto-fetch Interval Dropdown** — Options: "Off", "15 min", "30 min", "1 hour", "6 hours", "12 hours", "24 hours"
  - Persists to settings (`autoFetchIntervalMs` in **milliseconds**)
  - Default: "1 hour" (3_600_000 ms)
- [ ] **Theme Selector** — Options: "System", "Light", "Dark"
  - Persists to settings (`theme`)
  - Applies immediately via `document.documentElement.classList` toggle
- [ ] **Show Completed Toggle** — Persists to settings (`showCompletedAssignments`)
- [ ] **Save Button** — Persists all settings via `settings:set` IPC
- [ ] **Reset Button** — Calls `settings:reset` IPC, reloads defaults

### Non-Functional

- [ ] Accessible: proper labels, focus management, ARIA attributes
- [ ] Responsive: works at min-width 800px
- [ ] Form validation with helpful error messages
- [ ] Optimistic UI for theme change (instant), server-confirmed for others
- [ ] Keyboard navigable (Tab, Escape to close)

---

## Designs & Constraints

- **Location**: `src/frontend/src/components/SettingsModal.tsx` (or `SettingsPage.tsx` if full page)
- **State Management**: Zustand store for settings (sync with backend via IPC)
- **IPC Channels** (from `src/backend/shared/ipc.ts`):
  - `settings:get` — load on mount
  - `settings:set` — save on submit (accepts `Partial<Settings>`)
  - `settings:reset` — reset to defaults
  - `ical:fetch` + `ical:import` — for "Fetch Now"
  - `ical:progress` — subscribe for progress updates
  - `settings:changed` — subscribe for external changes
- **Settings Type** (after ticket 1.0):
  ```typescript
  interface Settings {
    theme: 'light' | 'dark' | 'system';
    autoFetchIcal: boolean;
    icalFetchIntervalMinutes: number;
    defaultPriority: number;
    showCompletedAssignments: boolean;
    notifyDueSoon: boolean;
    dueSoonThresholdHours: number;
    icalUrl: string; // decrypted (added by ticket 1.0)
    lastSyncAt: number | null; // added by ticket 1.0
    autoFetchIntervalMs: number; // added by ticket 1.0 (replaces icalFetchIntervalMinutes)
  }
  ```
- **Theme Application**:
  ```typescript
  const applyTheme = (theme: 'system' | 'light' | 'dark') => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  };
  ```

---

## Code Changes

### New Files

- `src/frontend/src/components/SettingsModal.tsx` — main settings component
- `src/frontend/src/components/SettingsModal.stories.tsx` — Storybook stories (optional)
- `src/frontend/src/__tests__/SettingsModal.test.tsx` — component tests

### Modified Files

- `src/frontend/src/store/settingsStore.ts` — Zustand store for settings state
- `src/frontend/src/hooks/useIcalSync.ts` — custom hook for fetch/import logic
- `src/frontend/src/App.tsx` — add Settings modal trigger/state

---

## Acceptance Criteria

| #   | Criterion                                        | Verification                            |
| --- | ------------------------------------------------ | --------------------------------------- |
| 1   | Settings modal opens from gear icon              | Visual test                             |
| 2   | iCal URL input shows current URL (decrypted)     | Test with pre-set settings              |
| 3   | "Fetch Now" triggers fetch → parse → import flow | Integration test with mock IPC          |
| 4   | Progress events update UI during fetch/import    | Test `ical:progress` subscription       |
| 5   | Auto-fetch interval persists and loads           | Test `settings:set`/`get` roundtrip     |
| 6   | Theme selector applies immediately               | Visual test + localStorage check        |
| 7   | Save button persists all settings                | Test `settings:set` IPC call            |
| 8   | Reset button restores defaults                   | Test `settings:reset` IPC call          |
| 9   | Form validation shows inline errors              | Test invalid URL, empty required fields |
| 10  | Accessible (labels, focus, ARIA)                 | axe-core test / manual audit            |
| 11  | All tests pass (`pnpm test`)                     | CI run                                  |

---

## Notes

- iCal URL is stored encrypted (ticket 1.7) — Settings UI receives decrypted value from `settings:get`
- "Fetch Now" should use the URL from the input field (not necessarily saved yet) for immediate feedback
- Auto-fetch scheduling implementation deferred to Phase 2 (just persist the interval here)
- Theme default: "System" — respects OS preference

---

## Release Summary

Add Settings modal with iCal URL input, Fetch Now, auto-fetch interval, and theme selector
