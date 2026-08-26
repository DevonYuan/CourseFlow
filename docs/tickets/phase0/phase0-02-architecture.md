# Ticket: phase0-02-architecture

**Phase:** 0 — Foundations & Tooling  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Document and codify the Process Architecture & IPC Contract that all future tickets will follow. This ticket produces a living architecture decision record (ADR) and the TypeScript interfaces that enforce the contract at compile time.

---

## Requirements

### Functional

- Define the **backend/frontend** architecture within Electron's two-process model: **Backend (Main + Preload)**, **Frontend (Renderer)** — responsibilities and boundaries
- Define the **IPC schema** (channel names, request/response payloads, event names) as TypeScript types in `src/backend/shared/ipc.ts`
- Establish the **contextBridge exposure** pattern (whitelist-only, no `ipcRenderer` leak to renderer)
- Document the **data flow** for the two Phase 1 features: (1) iCal fetch → parse → store, (2) CRUD for assignments/priorities/sub-tasks/notes

### Non-Functional

- Main process **never** imports renderer code; renderer **never** imports Node/Electron APIs directly
- Shared code (`src/backend/shared/`) has **zero** Electron/Node dependencies
- All IPC goes through typed channels — no stringly-typed `invoke`/`on` in feature code
- Single source of truth for channel names (const objects, not magic strings)

---

## Designs & Constraints

### Process Responsibilities

| Process                 | Responsibilities                                                                                                                              | Forbidden                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Backend (Main)**      | Window lifecycle, native menus, dialogs, auto-updater, SQLite DB (single connection), iCal network fetch, IPC handlers, app protocol handling | React, DOM, CSS, Vite HMR                     |
| **Backend (Preload)**   | `contextBridge.exposeInMainWorld('api', { ... })` — typed wrappers around `ipcRenderer.invoke/on`                                             | Business logic, DB access, network            |
| **Frontend (Renderer)** | React UI, Zustand stores, user interactions, calls `window.api.*`                                                                             | `require`, `process`, `fs`, `net`, `electron` |

### IPC Channel Convention

```
Namespace:  "app:" | "db:" | "ical:" | "settings:"
Pattern:    "<namespace>:<action>"  (e.g., "db:assignments:list", "ical:fetch", "settings:get")
Events:     "<namespace>:<event>"   (e.g., "db:changed", "ical:progress")
```

### TypeScript Contract (src/backend/shared/ipc.ts)

```ts
// Example shape — finalize exact payloads in this ticket
export interface IpcChannels {
  'db:assignments:list': { request: void; response: Assignment[] };
  'db:assignments:upsert': { request: AssignmentInput; response: Assignment };
  'db:assignments:delete': { request: string; response: void };
  'db:priority:reorder': { request: string[]; response: void };
  'ical:fetch': { request: { url: string }; response: ICalEvent[] };
  'settings:get': { request: void; response: Settings };
  'settings:set': { request: Partial<Settings>; response: Settings };
}

export type IpcEvents = {
  'db:changed': { table: string; action: 'insert' | 'update' | 'delete'; id: string };
  'ical:progress': { stage: 'fetch' | 'parse' | 'store'; progress: number };
};
```

### ContextBridge API Shape (src/preload/index.ts)

```ts
// Renderer sees: window.api.db.assignments.list(), window.api.ical.fetch(url), etc.
// No raw ipcRenderer exposed.
```

---

## Code Changes

### New Files

- `docs/architecture/process-model.md` (ADR-style: context, decision, consequences)
- `docs/architecture/ipc-contract.md` (channel registry + payload docs)
- `src/backend/shared/ipc.ts` (TypeScript interfaces above)
- `src/backend/shared/types.ts` (core domain types: `Assignment`, `SubTask`, `Note`, `PriorityOrder`, `Settings`, `ICalEvent`)

### Modified Files

- `src/backend/preload/index.ts` — implement typed `contextBridge` exposure using `ipc.ts` types
- `src/backend/main/ipc-handlers.ts` — skeleton handlers keyed by `ipc.ts` channels (throw `NotImplementedError` for now)

---

## Acceptance Criteria

| #   | Criterion                                                                                             | Verification                                            |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `src/backend/shared/ipc.ts` exports `IpcChannels` and `IpcEvents` with all planned Phase 0–1 channels | Code review                                             |
| 2   | `src/backend/shared/types.ts` exports all domain types used in IPC payloads                           | Code review                                             |
| 3   | `src/backend/preload/index.ts` exposes `window.api` with **full type safety** (no `any`)              | `pnpm typecheck` passes                                 |
| 4   | `src/backend/main/ipc-handlers.ts` registers a handler for every `IpcChannels` key (stub OK)          | Search for `ipcMain.handle` count matches channel count |
| 5   | Renderer can import `ipc.ts` types and call `window.api.*` with autocomplete                          | Manual test in `App.tsx`                                |
| 6   | No forbidden cross-process imports (enforced by ESLint `import/no-restricted-paths`)                  | `pnpm lint` passes                                      |

---

## Notes

- This ticket **resolves** the "Define IPC schema (channels, payloads, error handling)" and "ContextBridge pattern" open items in `docs/tickets/phase0/README.md`.
- The ADR documents _why_ we chose this model (security, testability, maintainability).
- Keep payloads minimal — add fields only when a downstream ticket needs them.
- Error handling: IPC handlers return `{ ok: true; data: T } | { ok: false; error: string }` — define this wrapper in `ipc.ts`.

---

## Release Summary

> **What:** Documented and type-enforced the three-process architecture, IPC channel registry, payload types, and contextBridge contract.  
> **Why:** Prevents architectural drift; gives every feature ticket a compile-time contract to code against.  
> **Impact:** Zero user-visible change. All future tickets import from `src/backend/shared/ipc.ts` and `src/backend/shared/types.ts`.
