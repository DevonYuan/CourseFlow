# Architecture Decision Record: Electron Process Model

**Status:** Accepted  
**Date:** 2026-08-25  
**Ticket:** phase0-02-architecture

---

## Context

CourseFlow is an Electron application with a React frontend. Electron's multi-process architecture requires explicit decisions about:

1. **Process responsibilities** — which process owns which capabilities
2. **IPC contracts** — how processes communicate with type safety
3. **Security boundaries** — preventing renderer access to Node/Electron APIs
4. **Code sharing** — what types/logic can be shared across processes

The team needs a documented, enforceable architecture before building features.

---

## Decision

We adopt a **three-process model** with strict boundaries:

### 1. Backend — Main Process (`src/backend/main/`)

- **Owns:** Window lifecycle, native menus, system dialogs, auto-updater
- **Owns:** SQLite database (single connection, WAL mode)
- **Owns:** Network I/O (iCal fetch with retry/backoff)
- **Owns:** IPC request handlers (registered via `ipcMain.handle`)
- **Owns:** Background auto-fetch scheduler (`src/backend/main/scheduler.ts`)
- **Owns:** App protocol handling (`courseflow://`)
- **Forbidden:** React, DOM, CSS, Vite HMR, any renderer-side code

> **Current implementation note:** the app implements window lifecycle, SQLite,
> iCal fetch/import, IPC handlers, and the scheduler. Native menus/dialogs,
> auto-update, and the `courseflow://` protocol are **not implemented yet**.

### 2. Backend — Preload Process (`src/backend/preload/`)

- **Owns:** `contextBridge.exposeInMainWorld('api', { ... })`
- **Owns:** Typed wrappers around `ipcRenderer.invoke` / `ipcRenderer.on`
- **Forbidden:** Business logic, database access, network I/O, any side effects

### 3. Frontend — Renderer Process (`src/frontend/`)

- **Owns:** React UI components, Zustand stores, user interactions
- **Owns:** Calls `window.api.*` for all backend communication
- **Forbidden:** `require`, `process`, `fs`, `net`, `electron`, any Node/Electron APIs

### 4. Shared Code (`src/backend/shared/`)

- **Contains:** TypeScript interfaces for IPC channels (`ipc.ts`)
- **Contains:** Domain types (`types.ts`: `Assignment`, `SubTask`, `Note`, `PriorityOrder`, `Settings`, `ICalEvent`)
- **Forbidden:** **Zero** Electron/Node dependencies — pure TypeScript only
- **Consumed by:** Main, Preload, and Renderer (via project references)

---

## IPC Channel Convention

| Category  | Namespace    | Pattern                | Example                                         |
| --------- | ------------ | ---------------------- | ----------------------------------------------- |
| Database  | `db:`        | `db:<entity>:<action>` | `db:assignments:list`, `db:priority:reorder`    |
| iCal      | `ical:`      | `ical:<action>`        | `ical:fetch`, `ical:import`                     |
| Settings  | `settings:`  | `settings:<action>`    | `settings:get`, `settings:set`                  |
| Scheduler | `scheduler:` | `scheduler:<action>`   | `scheduler:status`, `scheduler:trigger`         |
| App       | `app:`       | `app:<action>`         | `app:version`                                   |
| Events    | (same)       | `<namespace>:<event>`  | `db:changed`, `ical:progress`, `scheduler:tick` |

**All channels defined in** `src/backend/shared/ipc.ts` **as `IpcChannels` and `IpcEvents`**.

---

## ContextBridge Exposure Pattern (abridged)

```typescript
// src/backend/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  db: {
    assignments: {
      list: () => ipcRenderer.invoke('db:assignments:list'),
      upsert: (input) => ipcRenderer.invoke('db:assignments:upsert', input),
      delete: (id) => ipcRenderer.invoke('db:assignments:delete', id),
    },
    priority: {
      reorder: (ids) => ipcRenderer.invoke('db:priority:reorder', ids),
    },
  },
  ical: {
    fetch: (url) => ipcRenderer.invoke('ical:fetch', { url }),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial),
  },
  onDbChanged: (cb) => ipcRenderer.on('db:changed', (_e, payload) => cb(payload)),
  onIcalProgress: (cb) => ipcRenderer.on('ical:progress', (_e, payload) => cb(payload)),
});
```

> The full bridge also exposes `db.subtasks.*`, `db.notes.*`,
> `db.priority.list`, and `scheduler.*` — see `src/backend/preload/index.ts`.

**Renderer usage:**

```typescript
// Fully typed, no `any`
const assignments = await window.api.db.assignments.list();
window.api.onDbChanged(({ table, action, id }) => { ... });
```

---

## Error Handling Contract

All IPC responses follow a unified wrapper:

```typescript
// Defined in src/backend/shared/ipc.ts
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
```

- Handlers **always** return `IpcResult<T>` — never throw across IPC
- Renderer checks `result.ok` before accessing `result.data`
- Error `code` enables programmatic handling (e.g., `NOT_FOUND`, `VALIDATION_ERROR`)

---

## Consequences

### Positive

- **Compile-time safety:** Channel names, payloads, and responses are TypeScript types
- **Security:** Renderer has zero access to Node/Electron APIs; preload is the only bridge
- **Testability:** Main process handlers are pure functions (input → `IpcResult<T>`) — unit testable without Electron
- **Maintainability:** Single source of truth for all IPC contracts; adding a channel updates types everywhere
- **Architectural drift prevention:** ESLint rules forbid cross-process imports

### Negative

- **Boilerplate:** New channels require updates in 3 places (ipc.ts, preload, main handler)
- **Learning curve:** Team must understand the three-process boundary model

### Mitigation

- Boilerplate is minimal and enforced by types — catch errors at compile time
- This ticket produces the starter templates; future tickets follow the pattern

---

## Enforcement

| Rule                                 | Tool       | Config                                     |
| ------------------------------------ | ---------- | ------------------------------------------ |
| Main never imports renderer          | ESLint     | `import/no-restricted-paths`               |
| Renderer never imports Node/Electron | ESLint     | `import/no-restricted-paths`               |
| Shared has zero Electron/Node deps   | ESLint     | `no-restricted-imports` in shared tsconfig |
| All IPC typed via `ipc.ts`           | TypeScript | Strict mode + `noImplicitAny`              |

---

## References

- [IPC Contract Documentation](./ipc-contract.md)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [ContextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge)
