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

| Channel                 | Request           | Response             | Description                               |
| ----------------------- | ----------------- | -------------------- | ----------------------------------------- |
| `db:assignments:list`   | `void`            | `Assignment[]`       | Fetch all assignments ordered by priority |
| `db:assignments:get`    | `string` (id)     | `Assignment \| null` | Fetch single assignment by ID             |
| `db:assignments:upsert` | `AssignmentInput` | `Assignment`         | Create or update assignment               |
| `db:assignments:delete` | `string` (id)     | `void`               | Delete assignment by ID                   |

### Database — SubTasks

| Channel              | Request                              | Response    | Description                      |
| -------------------- | ------------------------------------ | ----------- | -------------------------------- |
| `db:subtasks:list`   | `string` (assignmentId)              | `SubTask[]` | Fetch subtasks for an assignment |
| `db:subtasks:upsert` | `SubTaskInput`                       | `SubTask`   | Create or update subtask         |
| `db:subtasks:delete` | `string` (id)                        | `void`      | Delete subtask by ID             |
| `db:subtasks:toggle` | `{ id: string; completed: boolean }` | `SubTask`   | Toggle subtask completion        |

### Database — Notes

| Channel           | Request                 | Response | Description                   |
| ----------------- | ----------------------- | -------- | ----------------------------- |
| `db:notes:list`   | `string` (assignmentId) | `Note[]` | Fetch notes for an assignment |
| `db:notes:upsert` | `NoteInput`             | `Note`   | Create or update note         |
| `db:notes:delete` | `string` (id)           | `void`   | Delete note by ID             |

### Database — Priority Order

| Channel               | Request                  | Response          | Description                     |
| --------------------- | ------------------------ | ----------------- | ------------------------------- |
| `db:priority:list`    | `void`                   | `PriorityOrder[]` | Fetch all priority orders       |
| `db:priority:reorder` | `string[]` (ordered IDs) | `void`            | Bulk reorder priority           |
| `db:priority:upsert`  | `PriorityOrderInput`     | `PriorityOrder`   | Create or update priority entry |

### iCal Integration

| Channel       | Request                                      | Response                                | Description                         |
| ------------- | -------------------------------------------- | --------------------------------------- | ----------------------------------- |
| `ical:fetch`  | `{ url: string }`                            | `ICalEvent[]`                           | Fetch and parse iCal from URL       |
| `ical:import` | `{ events: ICalEvent[]; sourceUrl: string }` | `{ imported: number; skipped: number }` | Import parsed events as assignments |

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

| Event              | Payload                                                                   | Description                    |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------ |
| `db:changed`       | `{ table: string; action: 'insert' \| 'update' \| 'delete'; id: string }` | Database mutation notification |
| `ical:progress`    | `{ stage: 'fetch' \| 'parse' \| 'store'; progress: number }`              | iCal import progress (0–100)   |
| `settings:changed` | `Settings`                                                                | Settings updated (broadcast)   |

---

## Payload Type References

All payload types are defined in `src/backend/shared/types.ts`:

- `Assignment`, `AssignmentInput`
- `SubTask`, `SubTaskInput`
- `Note`, `NoteInput`
- `PriorityOrder`, `PriorityOrderInput`
- `Settings`
- `ICalEvent`
- `IpcResult<T>` — response wrapper

---

## Error Handling

Every request/response channel returns `IpcResult<T>`:

```typescript
type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
```

**Standard error codes:**

- `NOT_FOUND` — Entity not found
- `VALIDATION_ERROR` — Input validation failed
- `CONFLICT` — Unique constraint violation
- `UNAUTHORIZED` — Not applicable (local app), reserved
- `INTERNAL_ERROR` — Unexpected failure

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
