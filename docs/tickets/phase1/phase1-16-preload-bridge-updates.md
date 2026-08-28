# Ticket: phase1-16-preload-bridge-updates

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.25 day

---

## Description

Verify and extend the preload bridge (`src/backend/preload/index.ts`) to expose all IPC channels needed by Phase 1 frontend tickets.

---

## PREREQUISITE

**This ticket depends on Ticket 1.0 (Data Model Alignment) being completed first.**

The IPC contracts in `src/backend/shared/ipc.ts` will be updated by Ticket 1.0. This ticket ensures the preload bridge matches those contracts.

---

## Requirements

### Functional

- [ ] **Verify existing channels** (already implemented in Phase 0):
  - `db:assignments:list` → `window.api.db.assignments.list()`
  - `db:assignments:upsert` → `window.api.db.assignments.upsert(input)`
  - `db:assignments:delete` → `window.api.db.assignments.delete(id)`
  - `settings:get` → `window.api.settings.get()`
  - `settings:upsert` → `window.api.settings.upsert(input)`
  - `ical:fetch` → `window.api.ical.fetch(url)`
  - `ical:import` → `window.api.ical.import(events, url)`
  - `onDbChanged` → `window.api.onDbChanged(callback)`
  - `onIcalProgress` → `window.api.onIcalProgress(callback)`
  - `onSettingsChanged` → `window.api.onSettingsChanged(callback)`

- [ ] **Add/verify channels for new fields** (after Ticket 1.0):
  - `settings:get` returns `Settings` with `icalUrl`, `lastSyncAt`
  - `settings:upsert` accepts `Settings` with new fields
  - `ical:import` response includes `updated` count
  - `db:assignments:upsert` accepts full `AssignmentInput` (all 20+ fields)

- [ ] **Type Safety**: All exposed APIs match `src/backend/shared/ipc.ts` contracts exactly

### Non-Functional

- [ ] **Context Isolation**: Uses `contextBridge.exposeInMainWorld` correctly
- [ ] **No Prototype Pollution**: Validates input types
- [ ] **Error Handling**: Wraps IPC calls in try/catch, returns `IpcResult<T>`

---

## Designs & Constraints

- **Location**: `src/backend/preload/index.ts`
- **Shared Types**: Import from `src/backend/shared/ipc.ts` and `src/backend/shared/types.ts`
- **Pattern**: Follow existing implementation style

### Example Channel Exposure

```typescript
// Current pattern in preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type {
  IpcChannels,
  IpcEvents,
  Assignment,
  AssignmentInput,
  Settings,
  ICalEvent,
} from '../shared';

contextBridge.exposeInMainWorld('api', {
  db: {
    assignments: {
      list: () => ipcRenderer.invoke('db:assignments:list'),
      upsert: (input: AssignmentInput) => ipcRenderer.invoke('db:assignments:upsert', input),
      delete: (id: string) => ipcRenderer.invoke('db:assignments:delete', id),
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    upsert: (input: Partial<Settings>) => ipcRenderer.invoke('settings:upsert', input),
  },
  ical: {
    fetch: (url: string) => ipcRenderer.invoke('ical:fetch', url),
    import: (events: ICalEvent[], url: string) =>
      ipcRenderer.invoke('ical:import', { events, url }),
  },
  onDbChanged: (callback: (payload: IpcEvents['db:changed']) => void) => {
    ipcRenderer.on('db:changed', (_e, payload) => callback(payload));
    return () => ipcRenderer.off('db:changed', (_e, payload) => callback(payload));
  },
  // ... etc
});
```

---

## Code Changes

### Modified Files

- `src/backend/preload/index.ts` — verify/extend all channel exposures

### New Files

- `src/backend/preload/__tests__/preload.test.ts` — verify exposed API shape

---

## Acceptance Criteria

| #   | Criterion                                              | Verification              |
| --- | ------------------------------------------------------ | ------------------------- |
| 1   | All Phase 0 channels still work                        | Existing tests pass       |
| 2   | `settings:get` returns `icalUrl`, `lastSyncAt`         | TypeScript + runtime test |
| 3   | `settings:upsert` accepts new fields                   | TypeScript + runtime test |
| 4   | `ical:import` response has `updated`                   | TypeScript + runtime test |
| 5   | `db:assignments:upsert` accepts full `AssignmentInput` | TypeScript compiles       |
| 6   | Event subscriptions work (`onDbChanged`, etc.)         | Integration test          |
| 7   | No TypeScript errors                                   | `pnpm typecheck`          |

---

## Notes

- This is primarily a **verification** ticket — most channels already exist from Phase 0
- Only changes needed are those driven by Ticket 1.0 contract updates
- Run `pnpm typecheck` after Ticket 1.0 to identify any mismatches

---

## Release Summary

Verify preload bridge matches updated IPC contracts from Data Model Alignment
