---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-00-data-model-update

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** Critical (Blocking)  
**Estimated Effort:** 0.5 day

---

## Description

Extend shared types, IPC contracts, database schema, and repository mappers to support Phase 2 entities: `PriorityOrder`, filter/sort/group state, and scheduler configuration. All other Phase 2 tickets depend on this alignment.

---

## Requirements

### Functional

- [ ] Add `PriorityOrder` type to `src/backend/shared/types.ts` with fields: `assignment_id` (FK, PK), `position` (INTEGER)
- [ ] Add `FilterState` type: `courseFilter: string[]`, `statusFilter: 'all' | 'pending' | 'completed'`, `dueDateRange: { start: Date; end: Date } | null`, `searchQuery: string`
- [ ] Add `SortOption` type: `'priority' | 'dueDateAsc' | 'dueDateDesc' | 'course' | 'createdDesc'`
- [ ] Add `GroupingType` type: `'none' | 'week' | 'status' | 'course'`
- [ ] Add `SchedulerConfig` type: `enabled: boolean`, `intervalMinutes: number`, `lastRun: string | null`, `nextRun: string | null`
- [ ] Extend `Settings` type with `sync_interval_minutes` (default: 15)
- [ ] Update IPC contracts in `src/backend/shared/ipc.ts` for all new channels (see tickets 2.2, 2.14)
- [ ] Update database schema in `src/backend/main/db/schema.sql` with `priority_order` table
- [ ] Extend repository mappers in `src/backend/main/db/mappers.ts` for `PriorityOrder`

### Non-Functional

- [ ] Zero Electron/Node dependencies in `src/backend/shared/` — pure TypeScript only
- [ ] All types exported from `src/backend/shared/index.ts`
- [ ] IPC channel names follow convention: `db:priority:*`, `scheduler:*`
- [ ] Database migration created (see ticket 2.17)

---

## Designs & Constraints

- **Shared types location**: `src/backend/shared/types.ts` (single source of truth)
- **IPC contracts location**: `src/backend/shared/ipc.ts` — defines `IpcChannels` and `IpcEvents`
- **Database schema location**: `src/backend/main/db/schema.sql` — SQLite DDL
- **Repository mappers**: `src/backend/main/db/mappers.ts` — row ↔ domain object conversion
- **PriorityOrder table**: `assignment_id TEXT PRIMARY KEY REFERENCES assignments(id), position INTEGER NOT NULL`
- **Indexes**: `priority_order` PK is sufficient; no additional indexes needed
- **Filter/Sort/Group state**: Stored in frontend `localStorage` (not DB) — no backend schema needed
- **Scheduler config**: Stored in `settings` table via `sync_interval_minutes` key

### New IPC Channels (to define in ipc.ts)

| Channel               | Request                             | Response          | Description                              |
| --------------------- | ----------------------------------- | ----------------- | ---------------------------------------- |
| `db:priority:list`    | `void`                              | `PriorityOrder[]` | Fetch all priority orders                |
| `db:priority:reorder` | `string[]` (ordered assignment IDs) | `void`            | Bulk reorder priority                    |
| `db:priority:upsert`  | `PriorityOrderInput`                | `PriorityOrder`   | Create or update priority entry          |
| `scheduler:start`     | `void`                              | `void`            | Start background scheduler (for testing) |
| `scheduler:stop`      | `void`                              | `void`            | Stop background scheduler (for testing)  |
| `scheduler:status`    | `void`                              | `SchedulerStatus` | Get scheduler status                     |

### New Events (Main → Renderer)

| Event             | Payload               | Description                                           |
| ----------------- | --------------------- | ----------------------------------------------------- |
| `scheduler:tick`  | `{ nextRun: string }` | Emitted on each scheduler interval (for UI countdown) |
| `scheduler:error` | `{ message: string }` | Scheduler error (network, auth, parse)                |

---

## Code Changes

### New Files

- None (all modifications to existing files)

### Modified Files

- `src/backend/shared/types.ts` — add `PriorityOrder`, `PriorityOrderInput`, `FilterState`, `SortOption`, `GroupingType`, `SchedulerConfig`, `SchedulerStatus`
- `src/backend/shared/ipc.ts` — add new channels to `IpcChannels` and `IpcEvents`
- `src/backend/shared/index.ts` — export new types
- `src/backend/main/db/schema.sql` — add `priority_order` table
- `src/backend/main/db/mappers.ts` — add `mapPriorityOrderRow`, `mapPriorityOrderInput`
- `src/backend/main/db/repository.ts` — add `PriorityOrderRepository` methods

---

## Acceptance Criteria

| #   | Criterion                                                               | Verification     |
| --- | ----------------------------------------------------------------------- | ---------------- |
| 1   | All new types compile without errors in shared, main, preload, renderer | `pnpm typecheck` |
| 2   | IPC channel names follow convention and are typed end-to-end            | Code review      |
| 3   | `priority_order` table defined in schema.sql with correct FK            | Schema review    |
| 4   | Repository mappers handle null/undefined correctly                      | Unit tests       |
| 5   | No circular dependencies introduced                                     | `pnpm typecheck` |

---

## Notes

- This ticket must be completed **before** any other Phase 2 ticket starts
- Filter/Sort/Group state lives in frontend Zustand store + localStorage — no backend persistence needed
- Scheduler config uses existing `settings` table (key: `sync_interval_minutes`)
- `PriorityOrderInput` excludes `assignment_id` (derived from context) or includes it — decide consistently
- Consider adding `created_at`/`updated_at` to `PriorityOrder` for audit trail (deferred to Phase 3 if needed)

---

## Release Summary

Align data model, IPC contracts, and schema for Phase 2 priority, filtering, grouping, and scheduler features
