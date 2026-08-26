# Ticket: phase0-04-ipc

**Phase:** 0 — Foundations & Tooling  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Wire the typed IPC contract (from phase0-02) to the SQLite repository (from phase0-03) so the renderer can perform real CRUD operations through `window.api`. This ticket completes the end-to-end data path: Renderer → Preload (contextBridge) → Main (IPC handlers) → Repository → SQLite.

---

## Requirements

### Functional

- Every channel in `src/shared/ipc.ts` has a working handler in `src/main/ipc-handlers.ts`
- Handlers call the repository (no raw SQL in handlers)
- Request/response wrapper: `{ ok: true; data: T } | { ok: false; error: string }`
- Events emitted via `webContents.send` for `IpcEvents` (e.g., `db:changed` after mutations)
- Preload exposes `window.api` with **exact TypeScript parity** to `IpcChannels` — renderer gets full autocomplete

### Non-Functional

- No `any` in handler or preload code
- Handler errors caught and returned as `{ ok: false; error }` — never throw to crash main
- Input validation: reject unknown fields (strip or error)
- Event names match `IpcEvents` exactly

---

## Designs & Constraints

### Handler Pattern (src/main/ipc-handlers.ts)

```ts
import { ipcMain } from 'electron';
import { repo } from './db/repository';
import type { IpcChannels } from '../../shared/ipc';

type Handler<K extends keyof IpcChannels> = (
  _event: Electron.IpcMainInvokeEvent,
  req: IpcChannels[K]['request'],
) => Promise<IpcChannels[K]['response']> | IpcChannels[K]['response'];

function register<K extends keyof IpcChannels>(channel: K, handler: Handler<K>) {
  ipcMain.handle(channel, async (event, req) => {
    try {
      const data = await handler(event, req);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

// Example registrations
register('db:assignments:list', () => repo.listAssignments());
register('db:assignments:upsert', (_, req) => repo.upsertAssignment(req));
register('db:assignments:delete', (_, req) => {
  repo.deleteAssignment(req);
});
register('db:priority:reorder', (_, req) => {
  repo.setPriorityOrder(req);
});
register('db:assignments:listByCourse', (_, req) => repo.listAssignmentsByCourse(req));
// ... all channels
```

### Event Emission (after mutations)

```ts
function emitDbChanged(table: string, action: 'insert' | 'update' | 'delete', id: string) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('db:changed', { table, action, id });
  }
}
```

### Preload Exposure (src/preload/index.ts)

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels, IpcEvents } from '../shared/ipc';

type Api = {
  [K in keyof IpcChannels]: (req: IpcChannels[K]['request']) => Promise<IpcChannels[K]['response']>;
} & {
  on: <K extends keyof IpcEvents>(
    channel: K,
    listener: (payload: IpcEvents[K]) => void,
  ) => () => void;
  off: <K extends keyof IpcEvents>(channel: K, listener: (payload: IpcEvents[K]) => void) => void;
};

const api: Api = {
  // Generated from IpcChannels keys — keep in sync manually or via script
  'db:assignments:list': () => ipcRenderer.invoke('db:assignments:list'),
  'db:assignments:upsert': (req) => ipcRenderer.invoke('db:assignments:upsert', req),
  'db:assignments:delete': (req) => ipcRenderer.invoke('db:assignments:delete', req),
  'db:priority:reorder': (req) => ipcRenderer.invoke('db:priority:reorder', req),
  'db:assignments:listByCourse': (req) => ipcRenderer.invoke('db:assignments:listByCourse', req),
  'db:subTasks:list': (req) => ipcRenderer.invoke('db:subTasks:list', req),
  'db:subTasks:upsert': (req) => ipcRenderer.invoke('db:subTasks:upsert', req),
  'db:subTasks:delete': (req) => ipcRenderer.invoke('db:subTasks:delete', req),
  'db:subTasks:reorder': (req) => ipcRenderer.invoke('db:subTasks:reorder', req),
  'db:notes:get': (req) => ipcRenderer.invoke('db:notes:get', req),
  'db:notes:set': (req) => ipcRenderer.invoke('db:notes:set', req),
  'settings:get': () => ipcRenderer.invoke('settings:get'),
  'settings:set': (req) => ipcRenderer.invoke('settings:set', req),
  'ical:fetch': (req) => ipcRenderer.invoke('ical:fetch', req),

  on: (channel, listener) => {
    ipcRenderer.on(channel, (_e, payload) => listener(payload));
    return () => ipcRenderer.off(channel, listener);
  },
  off: (channel, listener) => ipcRenderer.off(channel, listener),
};

contextBridge.exposeInMainWorld('api', api);
```

---

## Code Changes

### Modified Files

- `src/main/ipc-handlers.ts` — implement all handlers using repository
- `src/preload/index.ts` — expose full typed `window.api` (above)
- `src/main/index.ts` — import `ipc-handlers.ts` to register handlers

### New Files (optional helper)

- `scripts/generate-preload.ts` — if you want to auto-generate the preload exposure from `ipc.ts` (not required, manual is fine for ~15 channels)

---

## Acceptance Criteria

| #   | Criterion                                                                         | Verification                                                  |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Renderer can call `window.api.db.assignments.list()` and get typed `Assignment[]` | Console test in dev                                           |
| 2   | Renderer can upsert → list → get → delete an assignment via `window.api`          | Full CRUD cycle                                               |
| 3   | Priority reorder via `window.api.db.priority.reorder(ids)` persists               | Restart, verify                                               |
| 4   | Sub-tasks CRUD works via `window.api.db.subTasks.*`                               | Console test                                                  |
| 5   | Notes get/set works via `window.api.db.notes.*`                                   | Console test                                                  |
| 6   | Settings get/set works via `window.api.settings.*`                                | Console test                                                  |
| 7   | `db:changed` event fires on every mutation (assignment, sub-task, note, priority) | Subscribe in renderer, trigger mutation, log payload          |
| 8   | All handlers return `{ ok: true; data }                                           | { ok: false; error }` — no uncaught exceptions crash main     | Simulate DB error (e.g., FK violation) |
| 9   | TypeScript compiles with zero errors (`pnpm typecheck`)                           | Run                                                           |
| 10  | No `any` in `src/main/ipc-handlers.ts` or `src/preload/index.ts`                  | `grep -r "any" src/main/ipc-handlers.ts src/preload/index.ts` |

---

## Notes

- This ticket **completes** the data-plane foundation. After this, the renderer has a fully typed, working backend.
- The `ical:fetch` handler will be a stub here (returns `{ ok: false; error: 'Not implemented' }`) — real implementation is Phase 1.
- Keep handler logic thin: validate → call repo → return. Business logic lives in repository or future service layer.
- If you add a channel later, update **three places**: `src/shared/ipc.ts`, `src/main/ipc-handlers.ts`, `src/preload/index.ts`. Consider a code-gen script if this becomes tedious.

---

## Release Summary

> **What:** Connected the typed IPC contract to the SQLite repository — renderer now has full CRUD via `window.api` with compile-time safety and runtime events.  
> **Why:** Completes the data-plane foundation; all Phase 1+ features consume this API.  
> **Impact:** Zero UI. Renderer console is now a functional admin tool for the database.
