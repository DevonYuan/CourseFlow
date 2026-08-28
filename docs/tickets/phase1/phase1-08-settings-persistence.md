# Ticket: phase1-08-settings-persistence

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Wire `settings:get` / `settings:set` / `settings:reset` IPC to the Settings repository. Load settings on app start; apply theme immediately. Implement repository functions for settings CRUD with JSON value storage.

**PREREQUISITE**: Ticket 1.0 (Data Model Alignment) extends `Settings` type and adds encryption for `icalUrl`.

---

## Requirements

### Functional

- [ ] **Repository Functions** (in `src/backend/main/db/repository.ts`):
  - `getAllSettings(): Promise<Settings>` — returns all settings as typed object (decrypts `icalUrl`)
  - `setSettings(partial: Partial<Settings>): Promise<Settings>` — merges and persists (encrypts `icalUrl`)
  - `resetSettings(): Promise<Settings>` — restores defaults
- [ ] **IPC Handlers** (in `src/backend/main/ipc-handlers.ts`):
  - `settings:get` → `repository.getAllSettings()`
  - `settings:set` → `repository.setSettings(partial)`
  - `settings:reset` → `repository.resetSettings()`
- [ ] **Defaults** (merged with stored values):
  ```typescript
  const DEFAULT_SETTINGS: Settings = {
    theme: 'system',
    autoFetchIcal: false,
    icalFetchIntervalMinutes: 60,
    defaultPriority: 100,
    showCompletedAssignments: true,
    notifyDueSoon: true,
    dueSoonThresholdHours: 24,
    icalUrl: '', // added by ticket 1.0
    lastSyncAt: null, // added by ticket 1.0
    autoFetchIntervalMs: 60 * 60 * 1000, // added by ticket 1.0 (1 hour)
  };
  ```
- [ ] **App Startup**: In `src/backend/main/index.ts`, call `repository.getAllSettings()` on launch, apply theme to main window, emit `settings:changed` event
- [ ] **Settings Changed Event**: Emit `settings:changed` event with full `Settings` object after any write

### Non-Functional

- [ ] **Storage**: `settings` table (key-value, JSON string values) — schema from Phase 0
- [ ] **Encryption**: `icalUrl` handled transparently via encryption module (ticket 1.7)
- [ ] **Typed**: `Settings` interface in `src/backend/shared/types.ts` (extended by ticket 1.0)
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

### `Settings` Type (in `src/backend/shared/types.ts` — extended by ticket 1.0)

```typescript
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  autoFetchIcal: boolean;
  icalFetchIntervalMinutes: number;
  defaultPriority: number;
  showCompletedAssignments: boolean;
  notifyDueSoon: boolean;
  dueSoonThresholdHours: number;
  icalUrl: string; // Decrypted (empty if not set) — added by ticket 1.0
  lastSyncAt: number | null; // Unix ms of last successful import — added by ticket 1.0
  autoFetchIntervalMs: number; // 0 = disabled — added by ticket 1.0
}
```

### Theme Application on Startup

```typescript
// In main/index.ts after window created
const settings = await repository.getAllSettings();
mainWindow.webContents.send('settings:changed', settings); // Renderer listens and applies theme
```

---

## Code Changes

### Modified Files

- `src/backend/main/db/repository.ts` — add `getAllSettings`, `setSettings`, `resetSettings`
- `src/backend/main/ipc-handlers.ts` — add three settings handlers
- `src/backend/main/index.ts` — load settings on startup, apply theme
- `src/backend/shared/types.ts` — verify `Settings` interface complete (extended by ticket 1.0)
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
