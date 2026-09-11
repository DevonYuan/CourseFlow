---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-16-preload-bridge-v2

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Extend `src/backend/preload/index.ts` to expose all new Phase 2 IPC channels: priority CRUD/reorder, scheduler control, and events. Ensure full TypeScript coverage end-to-end.

---

## Requirements

### Functional

- [ ] Expose `db.priority` namespace:
  - `list: () => Promise<PriorityOrder[]>`
  - `reorder: (ids: string[]) => Promise<void>`
  - `upsert: (input: PriorityOrderInput) => Promise<PriorityOrder>`
- [ ] Expose `scheduler` namespace:
  - `start: (intervalMinutes: number) => Promise<SchedulerStatus>`
  - `stop: () => Promise<SchedulerStatus>`
  - `status: () => Promise<SchedulerStatus>`
  - `trigger: () => Promise<void>`
  - `onTick: (cb: (payload: { nextRun: string }) => void) => () => void`
  - `onError: (cb: (payload: { message: string; code: string }) => void) => () => void`
- [ ] All functions typed using types from `src/backend/shared`
- [ ] Event listeners return cleanup function (call to remove listener)
- [ ] No business logic in preload — pure pass-through

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] `contextBridge.exposeInMainWorld('api', { ... })` structure maintained
- [ ] TypeScript compiles with strict mode
- [ ] Renderer can import types from `src/backend/shared` via project references

---

## Designs & Constraints

- **Location**: `src/backend/preload/index.ts`
- **Types**: Import from `src/backend/shared` (already available via project references)
- **Pattern**: Follow existing preload structure (db, ical, settings, onDbChanged, onIcalProgress)
- **Event cleanup**: Return `() => ipcRenderer.removeListener(channel, listener)`

### Preload API Structure (Final)

```typescript
contextBridge.exposeInMainWorld('api', {
  db: {
    assignments: { list, get, upsert, delete },
    priority: { list, reorder, upsert },        // NEW
    subtasks: { list, upsert, delete, toggle },
    notes: { list, upsert, delete },
  },
  ical: { fetch, import },
  settings: { get, set, reset },
  scheduler: {                                  // NEW
    start, stop, status, trigger,
    onTick, onError
  },
  onDbChanged: (cb) => ...,
  onIcalProgress: (cb) => ...,
  onSchedulerTick: (cb) => ...,                 // NEW (alias)
  onSchedulerError: (cb) => ...,                // NEW (alias)
  app: { version },
})
```

---

## Code Changes

### New Files

- None

### Modified Files

- `src/backend/preload/index.ts` — add priority + scheduler namespaces + event listeners
- `src/backend/shared/ipc.ts` — already has channel definitions (ticket 2.0)
- `src/backend/shared/types.ts` — already has types (ticket 2.0)

---

## Acceptance Criteria

| #   | Criterion                                                       | Verification     |
| --- | --------------------------------------------------------------- | ---------------- |
| 1   | `window.api.db.priority.list()` returns typed `PriorityOrder[]` | Renderer test    |
| 2   | `window.api.db.priority.reorder(ids)` calls IPC correctly       | Renderer test    |
| 3   | `window.api.scheduler.status()` returns `SchedulerStatus`       | Renderer test    |
| 4   | `window.api.scheduler.onTick(cb)` receives tick events          | Renderer test    |
| 5   | `window.api.scheduler.onError(cb)` receives error events        | Renderer test    |
| 6   | TypeScript compiles without errors in renderer                  | `pnpm typecheck` |
| 7   | All tests pass (`pnpm test`)                                    | CI run           |

---

## Notes

- This is the **last backend→frontend bridge** ticket for Phase 2
- After this, frontend can implement all UI features (tickets 2.3, 2.7, 2.11, 2.14)
- Event listeners: frontend must call cleanup on unmount (useEffect return)
- Consider adding `onSettingsChanged` for sync interval changes (already exists from Phase 1)

---

## Release Summary

Extend preload bridge with priority and scheduler IPC channels for full frontend access
