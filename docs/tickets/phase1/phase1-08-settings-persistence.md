# Ticket: phase1-08-settings-persistence

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Wire `settings:get` / `settings:set` / `settings:reset` IPC to the Settings repository. Load settings on app start; apply theme immediately. Implement repository functions for settings CRUD with JSON value storage.

---

## Requirements

### Functional

- [ ] **Repository Functions** (in `src/backend/main/db/repository.ts`):
  - `getSettings(): Promise<Settings>` — returns all settings as typed object
  - `setSettings(partial: Partial<Settings>): Promise<Settings>` — merges and persists
  - `resetSettings(): Promise<Settings>` — restores defaults
- [ ] **IPC Handlers** (in `src/backend/main/ipc-handlers.ts`):
  - `settings:get` → `repository.getSettings()`
  - `settings:set` → `repository.setSettings(partial)`
  - `settings:reset` → `repository.resetSettings()`
- [ ] **Defaults** (merged with stored values):
  ```typescript
  const DEFAULT_SETTINGS: Settings = {
    icalUrl: '',
    theme: 'system',
    autoFetchIntervalMs: 60 * 60 * 1000, // 1 hour
    lastSyncAt: null,
    showCompleted: false,
  };
  ```
- [ ] **App Startup**: In `src/backend/main/index.ts`, call `repository.getSettings()` on launch, apply theme to main window
- [ ] **Settings Changed Event**: Emit `settings:changed` event with full `Settings` object after any write

### Non-Functional

- [ ] **Storage**: `settings` table (key-value, JSON string values) — schema from Phase 0.3
- [ ] **Encryption**: `icalUrl` handled transparently via encryption module (ticket 1.7)
- [ ] **Typed**: `Settings` interface in `src/backend/shared/types.ts`
- [ ] **Atomic Writes**: Single transaction for multi-key updates

---

## Designs & Constraints

- **Location**: Repository methods in `src/backend/main/db/repository.ts`, handlers in `src/backend/main/ipc-handlers.ts`
- **IPC Contract** (from `src/backend/shared/ipc.ts`):

```typescript
'settings:get': { request: void; response: Settings };
'settings:set': { request: Partial<Settings>; response: Settings };
'settings:reset': { request: void; response: Settings };

// Event
'settings:changed': Settings;
```

### `Settings` Type (in `src/backend/shared/types.ts`)

```typescript
export interface Settings {
  icalUrl: string; // Decrypted (empty if not set)
  theme: 'system' | 'light' | 'dark';
  autoFetchIntervalMs: number; // 0 = disabled
  lastSyncAt: number | null; // Unix ms of last successful import
  showCompleted: boolean; // UI toggle
}
```

### Theme Application on Startup

```typescript
// In main/index.ts after window created
const settings = await repository.getSettings();
mainWindow.webContents.send('settings:changed', settings); // Or apply via preload
// Renderer listens for settings:changed and applies theme
```

---

## Code Changes

### Modified Files

- `src/backend/main/db/repository.ts` — add `getSettings`, `setSettings`, `resetSettings`
- `src/backend/main/ipc-handlers.ts` — add three settings handlers
- `src/backend/main/index.ts` — load settings on startup, apply theme
- `src/backend/shared/types.ts` — verify `Settings` interface complete
- `src/backend/main/db/__tests__/repository.settings.test.ts` — integration tests

### New Files

- `src/backend/main/db/__tests__/repository.settings.test.ts`

---

## Acceptance Criteria

| #   | Criterion                                                | Verification                                        |
| --- | -------------------------------------------------------- | --------------------------------------------------- |
| 1   | `settings:get` returns all settings with defaults merged | IPC test                                            |
| 2   | `settings:set` merges partial and persists               | Test: set only theme, verify icalUrl unchanged      |
| 3   | `settings:reset` restores all defaults                   | IPC test                                            |
| 4   | `icalUrl` encrypted on set, decrypted on get             | Integration test with encryption module             |
| 5   | App startup loads settings and applies theme             | E2E test: set theme=dark, restart, verify dark mode |
| 6   | `settings:changed` event emitted on write                | Test event bus                                      |
| 7   | All tests pass (`pnpm test`)                             | CI run                                              |

---

## Notes

- This ticket wires together the Settings UI (1.6), encryption (1.7), and IPC contract
- `autoFetchIntervalMs` persisted here but scheduler implemented in Phase 2
- `lastSyncAt` updated by `ical:import` handler (ticket 1.5) after successful import
- `showCompleted` used by Assignment List (ticket 1.9) for "Show Completed" toggle

---

## Release Summary

Wire settings IPC handlers with repository, encryption, and startup theme application
