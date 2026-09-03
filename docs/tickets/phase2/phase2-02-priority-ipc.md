---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-02-priority-ipc

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Implement IPC handlers for priority ordering in `src/backend/main/ipc-handlers.ts`. Exposes `db:priority:list`, `db:priority:reorder`, `db:priority:upsert` channels and emits `db:changed` events for priority mutations.

---

## Requirements

### Functional

- [ ] Register `ipcMain.handle('db:priority:list', ...)` → returns `PriorityOrder[]` ordered by position
- [ ] Register `ipcMain.handle('db:priority:reorder', ...)` → accepts `string[]` (ordered assignment IDs), calls `PriorityOrderRepository.reorder()`, emits `db:changed` for each affected assignment
- [ ] Register `ipcMain.handle('db:priority:upsert', ...)` → accepts `PriorityOrderInput`, calls `PriorityOrderRepository.upsert()`, emits `db:changed`
- [ ] Emit `db:changed` events with payload: `{ table: 'priority_order', action: 'insert' | 'update' | 'delete', id: assignmentId }`
- [ ] Input validation: `reorder` requires non-empty array of strings; `upsert` requires valid `assignment_id` and `position >= 0`
- [ ] Error handling: throw typed errors for invalid input, not found, DB errors

### Non-Functional

- [ ] All handlers async, return typed responses per `IpcChannels` contract
- [ ] No business logic in handlers — delegate to repository
- [ ] `db:changed` events emitted **after** successful DB commit
- [ ] Handlers registered in `initializeIpcHandlers()` function
- [ ] Zero `any` in implementation

---

## Designs & Constraints

- **Channel names**: Defined in `src/backend/shared/ipc.ts` (ticket 2.0)
- **Handler location**: `src/backend/main/ipc-handlers.ts`
- **Repository**: Uses `PriorityOrderRepository` from ticket 2.1
- **Event emission**: Use `mainWindow.webContents.send('db:changed', payload)` — ensure `mainWindow` reference available
- **Validation**: Use Zod or manual checks — keep lightweight

### Request/Response Types (from shared/ipc.ts)

```typescript
// Request
'db:priority:list': void
'db:priority:reorder': string[]  // ordered assignment IDs
'db:priority:upsert': PriorityOrderInput  // { assignment_id: string; position: number }

// Response
'db:priority:list': PriorityOrder[]
'db:priority:reorder': void
'db:priority:upsert': PriorityOrder
```

---

## Code Changes

### New Files

- None

### Modified Files

- `src/backend/main/ipc-handlers.ts` — add three handler registrations
- `src/backend/main/events.ts` — ensure `emitDbChanged` helper handles `priority_order` table

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `db:priority:list` returns all priority orders sorted by position | IPC test |
| 2 | `db:priority:reorder` updates positions and emits `db:changed` for each | IPC test + event spy |
| 3 | `db:priority:upsert` creates/updates single entry and emits `db:changed` | IPC test |
| 4 | Invalid input throws typed error (not generic Error) | Unit test |
| 5 | `db:changed` payload includes correct table/action/id | Event verification |
| 6 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- `reorder` is the primary operation for drag-and-drop — called once on drop with full ordered list
- `upsert` used for initial priority assignment on new imports (ticket 2.4)
- `db:changed` events allow frontend to reactively update (ticket 2.3)
- Ensure `mainWindow` is accessible in `ipc-handlers.ts` — typically passed during initialization
- Consider rate-limiting `reorder` if user drags rapidly (debounce in frontend, not backend)

---

## Release Summary

Add IPC handlers for priority order CRUD and bulk reorder with change events