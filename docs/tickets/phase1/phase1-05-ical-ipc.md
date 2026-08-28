# Ticket: phase1-05-ical-ipc

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Implement `ical:fetch` and `ical:import` IPC handlers in `src/backend/main/ipc-handlers.ts` using the fetch, parse, map, and dedup utilities. Emit `ical:progress` events (`fetch` → `parse` → `store`) for UI feedback.

---

## Requirements

### Functional

- [ ] **`ical:fetch` handler** — Request: `{ url: string }`, Response: `ICalEvent[]`
  - Call `fetchICalFeed(url)` → `parseICalFeed(text)` → return events
  - Emit `ical:progress` events: `{ stage: 'fetch', progress: 33 }` → `{ stage: 'parse', progress: 66 }`
  - Throw typed errors (`NetworkError`, `HttpError`, `TimeoutError`, `ICalParseError`) → wrapped in `IpcResult<ICalEvent[]>`
- [ ] **`ical:import` handler** — Request: `{ events: ICalEvent[]; sourceUrl: string }`, Response: `ImportResult`
  - Call `mapICalToAssignments(events, sourceUrl)` → `repository.importAssignments(inputs)`
  - Emit `ical:progress` event: `{ stage: 'store', progress: 100 }`
  - Return `{ imported, skipped, updated }` from repository
- [ ] **Progress events** — Use `eventBus.emit('ical:progress', payload)` for renderer subscription
- [ ] **Error handling** — All errors wrapped in `IpcResult` with `success: false`, `error: { code, message }`
- [ ] **Validation** — Reject empty events array; validate URL format for `ical:fetch`

### Non-Functional

- [ ] Handlers registered in `ipc-handlers.ts` via `ipcMain.handle`
- [ ] Channel names match `docs/architecture/ipc-contract.md` exactly: `ical:fetch`, `ical:import`
- [ ] Event name: `ical:progress` (matches IPC contract)
- [ ] Zero `any` — typed request/response via `IpcChannels` in `src/backend/shared/ipc.ts`
- [ ] Timeout: 30s for `ical:fetch`, 10s for `ical:import`

---

## Designs & Constraints

- **Location**: `src/backend/main/ipc-handlers.ts` (add to existing handlers)
- **Dependencies**: `fetchICalFeed`, `parseICalFeed`, `mapICalToAssignments`, `repository.importAssignments`
- **IPC Contract** (from `src/backend/shared/ipc.ts`):

```typescript
// Request/Response channels
'ical:fetch': { request: { url: string }; response: ICalEvent[] };
'ical:import': { request: { events: ICalEvent[]; sourceUrl: string }; response: ImportResult };

// Events (Main → Renderer)
'ical:progress': { stage: 'fetch' | 'parse' | 'store'; progress: number }; // 0-100
```

### Progress Event Stages

| Stage   | Progress | Description             |
| ------- | -------- | ----------------------- |
| `fetch` | 33       | iCal feed downloaded    |
| `parse` | 66       | iCal parsed to events   |
| `store` | 100      | Assignments saved to DB |

---

## Code Changes

### Modified Files

- `src/backend/main/ipc-handlers.ts` — add `ical:fetch` and `ical:import` handlers
- `src/backend/shared/ipc.ts` — verify channel definitions match (add if missing)
- `src/backend/main/__tests__/ipc.ical.test.ts` — integration tests for handlers

### New Types (if not in shared)

- `ImportResult` (from ticket 1.4) — ensure exported from shared types

---

## Acceptance Criteria

| #   | Criterion                                                                 | Verification                        |
| --- | ------------------------------------------------------------------------- | ----------------------------------- |
| 1   | `ical:fetch` returns parsed `ICalEvent[]` for valid URL                   | Integration test with mock fetch    |
| 2   | `ical:fetch` emits progress events (fetch → parse)                        | Test event emission                 |
| 3   | `ical:fetch` returns typed errors for network/HTTP/timeout/parse failures | Test each error type                |
| 4   | `ical:import` maps events → imports → returns counts                      | Integration test with sample events |
| 5   | `ical:import` emits progress event (store)                                | Test event emission                 |
| 6   | `ical:import` rejects empty events array                                  | Test validation                     |
| 7   | Channel names match IPC contract exactly                                  | Code review                         |
| 8   | All tests pass (`pnpm test`)                                              | CI run                              |

---

## Notes

- These handlers are the bridge between frontend (Settings "Fetch Now" button) and backend iCal logic
- Frontend calls `window.api.ical.fetch(url)` and `window.api.ical.import(events, sourceUrl)` via preload bridge
- Progress events enable sync status indicator (ticket 1.14) to show real-time feedback
- Error codes should be consistent: `NETWORK_ERROR`, `HTTP_ERROR`, `TIMEOUT_ERROR`, `PARSE_ERROR`, `VALIDATION_ERROR`

---

## Release Summary

Add IPC handlers for iCal fetch and import with progress events for UI feedback
