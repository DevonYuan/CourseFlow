# IPC Contract — Channel Registry & Payload Specifications

**Status:** Accepted  
**Date:** 2026-08-25  
**Ticket:** phase0-02-architecture  
**Source of Truth:** `src/backend/shared/ipc.ts` (this document mirrors the TypeScript definitions)

---

## Overview

All inter-process communication uses **typed channels** defined in `IpcChannels` (request/response) and `IpcEvents` (one-way notifications).  
Channel names follow the convention: `<namespace>:<entity>:<action>` or `<namespace>:<event>`.

---

## Channel Definitions

### Database — Assignments

| Channel                 | Request           | Response             | Description                                                                                                               |
| ----------------------- | ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `db:assignments:list`   | `void`            | `Assignment[]`       | Fetch all assignments ordered by due date (ascending); custom priority order is exposed separately via `db:priority:list` |
| `db:assignments:get`    | `string` (id)     | `Assignment \| null` | Fetch single assignment by ID                                                                                             |
| `db:assignments:upsert` | `AssignmentInput` | `Assignment`         | Create or update assignment                                                                                               |
| `db:assignments:delete` | `string` (id)     | `void`               | Delete assignment by ID                                                                                                   |

### Database — SubTasks

| Channel              | Request                              | Response    | Description                      |
| -------------------- | ------------------------------------ | ----------- | -------------------------------- |
| `db:subtasks:list`   | `string` (assignmentId)              | `SubTask[]` | Fetch subtasks for an assignment |
| `db:subtasks:upsert` | `SubTaskInput`                       | `SubTask`   | Create or update subtask         |
| `db:subtasks:delete` | `string` (id)                        | `void`      | Delete subtask by ID             |
| `db:subtasks:toggle` | `{ id: string; completed: boolean }` | `SubTask`   | Toggle subtask completion        |

### Database — Notes

Notes use a **1:N** model — multiple timestamped log entries per assignment.

| Channel           | Request                 | Response | Description                                                                                |
| ----------------- | ----------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `db:notes:list`   | `string` (assignmentId) | `Note[]` | Fetch notes for an assignment (newest first)                                               |
| `db:notes:upsert` | `NoteInput`             | `Note`   | Create a note when no `id` is provided; update an existing note's content when `id` is set |
| `db:notes:delete` | `string` (id)           | `void`   | Delete note by ID                                                                          |

`NoteInput` is `{ id?: EntityId; assignmentId: EntityId; content: string }`. The
`db:notes:upsert` handler emits `db:changed` with `action: 'insert'` for creates
and `action: 'update'` for edits, so renderers can distinguish the two.

### Database — Pages (Standalone Notes Workspace)

| Channel           | Request                                              | Response             | Description                                               |
| ----------------- | ---------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| `db:pages:list`   | `{ parentId?: string }`                              | `Page[]`             | Fetch pages (optionally filtered by parent; root if null) |
| `db:pages:get`    | `string` (id)                                        | `Page \| null`       | Fetch single page by ID                                   |
| `db:pages:tree`   | `void`                                               | `PageTreeNode[]`     | Fetch full page tree for sidebar (hierarchical)           |
| `db:pages:create` | `PageInput`                                          | `Page`               | Create new page                                           |
| `db:pages:update` | `PageUpdateInput`                                    | `Page`               | Update page (title, content, parent, position, icon)      |
| `db:pages:delete` | `string` (id)                                        | `void`               | Delete page (cascades to children)                        |
| `db:pages:move`   | `{ id: string; parentId: string; position: number }` | `Page`               | Move page to new parent/position                          |
| `db:pages:search` | `{ query: string; limit?: number }`                  | `PageSearchResult[]` | Search across pages (LIKE-based ranking; FTS5 unavailable in sql.js WASM) |

### Database — Calendar Sources (Multi-Calendar — Phase 4)

| Channel                    | Request                        | Response             | Description                                        |
| -------------------------- | ------------------------------ | -------------------- | -------------------------------------------------- |
| `db:calendars:list`        | `void`                         | `CalendarSource[]`   | Fetch all calendar sources                         |
| `db:calendars:get`         | `string` (id)                  | `CalendarSource \| null` | Fetch single calendar source by ID                |
| `db:calendars:create`      | `CalendarSourceInput`          | `CalendarSource`     | Create new calendar source (encrypted feed URL)    |
| `db:calendars:update`      | `CalendarSourceUpdateInput`    | `CalendarSource`     | Update calendar source (name, color, enabled, etc.) |
| `db:calendars:delete`      | `string` (id)                  | `void`               | Delete calendar source                             |
| `db:calendars:reorder`     | `string[]` (ordered IDs)       | `void`               | Bulk reorder calendar sources                      |
| `db:calendars:setEnabled`  | `{ id: string; enabled: boolean }` | `CalendarSource`  | Toggle calendar source enabled state               |

### Database — Priority Order

| Channel               | Request                  | Response          | Description                     |
| --------------------- | ------------------------ | ----------------- | ------------------------------- |
| `db:priority:list`    | `void`                   | `PriorityOrder[]` | Fetch all priority orders       |
| `db:priority:reorder` | `string[]` (ordered IDs) | `void`            | Bulk reorder priority           |
| `db:priority:upsert`  | `PriorityOrderInput`     | `PriorityOrder`   | Create or update priority entry |

### Scheduler

| Channel                | Request                       | Response          | Description                            |
| ---------------------- | ----------------------------- | ----------------- | -------------------------------------- |
| `scheduler:start`      | `{ intervalMinutes: number }` | `SchedulerStatus` | Start the background auto-fetch timer  |
| `scheduler:stop`       | `void`                        | `SchedulerStatus` | Stop the background auto-fetch timer   |
| `scheduler:status`     | `void`                        | `SchedulerStatus` | Current scheduler runtime status       |
| `scheduler:trigger`    | `void`                        | `void`            | Manual "Sync Now" (single fetch cycle) |
| `scheduler:config:get` | `void`                        | `SchedulerConfig` | Current scheduler configuration        |
| `scheduler:config:set` | `Partial<SchedulerConfig>`    | `SchedulerConfig` | Update scheduler configuration         |

### iCal Integration

| Channel       | Request                                      | Response                                          | Description                                                                                                       |
| ------------- | -------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ical:fetch`  | `{ url: string }`                            | `ICalEvent[]`                                     | Fetch and parse iCal from URL                                                                                     |
| `ical:import` | `{ events: ICalEvent[]; sourceUrl: string }` | `ImportResult` (`{ imported, updated, skipped }`) | Import parsed events as assignments (dedupe by `ical_uid`, preserve user-completed rows, prune stale `ical` rows) |

### Settings

| Channel          | Request             | Response   | Description             |
| ---------------- | ------------------- | ---------- | ----------------------- |
| `settings:get`   | `void`              | `Settings` | Fetch all settings      |
| `settings:set`   | `Partial<Settings>` | `Settings` | Update settings (merge) |
| `settings:reset` | `void`              | `Settings` | Reset to defaults       |

### App

| Channel       | Request | Response | Description     |
| ------------- | ------- | -------- | --------------- |
| `app:version` | `void`  | `string` | Get app version |

---

## Event Definitions (One-way, Main → Renderer)

| Event                 | Payload                                                                                                          | Description                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `db:changed`          | `{ table: string; action: 'insert' \| 'update' \| 'delete' \| 'reorder'; id: string }`                           | Database mutation notification        |
| `ical:progress`       | `{ stage: 'fetching' \| 'parsing' \| 'importing' \| 'complete' \| 'error'; progress: number; message?: string }` | iCal import progress (0–100)          |
| `settings:changed`    | `Settings`                                                                                                       | Settings updated (broadcast)          |
| `scheduler:tick`      | `{ nextRun: IsoDateTime }`                                                                                       | Scheduler next-run update             |
| `scheduler:error`     | `{ message: string; code: 'network' \| 'auth' \| 'parse' \| 'server' \| 'unknown' }`                             | Background fetch failed               |
| `scheduler:coalesced` | `{ message: string }`                                                                                            | Manual sync ignored (already running) |

---

## Payload Type References

All payload types are defined in `src/backend/shared/types.ts`:

- `Assignment`, `AssignmentInput`
- `SubTask`, `SubTaskInput`
- `Note`, `NoteInput`
- `Page`, `PageInput`, `PageUpdateInput`, `PageTreeNode`, `PageSearchResult`
- `PriorityOrder`, `PriorityOrderInput`
- `Settings`
- `CalendarSource`, `CalendarSourceInput`, `CalendarSourceUpdateInput`
- `ICalEvent`
- `ImportResult`
- `SchedulerConfig`, `SchedulerStatus`
- `IpcResult<T>` — response wrapper (defined in `src/backend/shared/ipc.ts`)

---

## Error Handling

Every request/response channel returns `IpcResult<T>`:

```typescript
type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
```

**Standard error codes** (mirrors `IpcErrorCode` in `src/backend/shared/ipc.ts`):

- `NOT_FOUND` — Entity not found
- `VALIDATION_ERROR` — Input validation failed
- `CONFLICT` — Unique constraint violation
- `INTERNAL_ERROR` — Unexpected failure
- `NETWORK_ERROR` — Network-level failure
- `HTTP_ERROR` — Bad HTTP response (4xx/5xx)
- `TIMEOUT_ERROR` — Request timed out
- `PARSE_ERROR` — Feed could not be parsed

Handlers **never throw** — always return `IpcResult`.

---

## Versioning Strategy

- **Additive only:** New channels added; existing channels never changed
- **Breaking changes:** New namespace (e.g., `db:v2:assignments:list`)
- **Deprecation:** Mark channel with `@deprecated` JSDoc; remove after 2 major versions

---

## Testing Contract Compliance

```typescript
// In renderer test:
import type { IpcChannels } from '@backend/shared/ipc';

// This compiles only if window.api matches IpcChannels
declare global {
  interface Window {
    api: {
      db: {
        assignments: {
          list: () => Promise<IpcResult<IpcChannels['db:assignments:list']['response']>>;
          // ...
        };
      };
    };
  }
}
```

---

## Related Files

| File                                 | Purpose                                      |
| ------------------------------------ | -------------------------------------------- |
| `src/backend/shared/ipc.ts`          | **Source of truth** — TypeScript definitions |
| `src/backend/shared/types.ts`        | Domain types used in payloads                |
| `src/backend/preload/index.ts`       | `contextBridge` exposure (typed)             |
| `src/backend/main/ipc-handlers.ts`   | Handler implementations                      |
| `docs/architecture/process-model.md` | Architecture decision record                 |
