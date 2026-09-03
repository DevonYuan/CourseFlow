---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-01-priority-schema

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Add `priority_order` table to SQLite schema and implement repository methods for CRUD and bulk reorder operations. This is the backend foundation for drag-and-drop priority persistence.

---

## Requirements

### Functional

- [ ] Add `priority_order` table to `schema.sql`:
  - `assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE`
  - `position INTEGER NOT NULL`
  - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
  - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
- [ ] Implement `PriorityOrderRepository` in `src/backend/main/db/repository.ts`:
  - `getAll(): Promise<PriorityOrder[]>` — ordered by `position ASC`
  - `getByAssignmentId(assignmentId: string): Promise<PriorityOrder | null>`
  - `upsert(input: PriorityOrderInput): Promise<PriorityOrder>` — insert or update position
  - `reorder(orderedAssignmentIds: string[]): Promise<void>` — bulk update positions in transaction
  - `delete(assignmentId: string): Promise<void>` — remove priority entry (called when assignment deleted)
- [ ] Add mappers in `src/backend/main/db/mappers.ts`:
  - `mapPriorityOrderRow(row): PriorityOrder`
  - `mapPriorityOrderInput(input): PriorityOrderInput` (validation)

### Non-Functional

- [ ] `reorder` uses a single transaction — all-or-nothing
- [ ] `position` values are contiguous integers starting from 0 (0 = highest priority)
- [ ] On assignment deletion, cascade deletes priority entry (via FK)
- [ ] New assignments get priority entry appended at end (max position + 1) — handled in import logic (ticket 2.4)
- [ ] Zero `any` in implementation
- [ ] Comprehensive JSDoc comments on public methods

---

## Designs & Constraints

- **Table name**: `priority_order` (snake_case per SQLite convention)
- **Primary key**: `assignment_id` (one-to-one with assignments)
- **Position semantics**: Lower number = higher priority (top of list = position 0)
- **Reorder algorithm**: Iterate `orderedAssignmentIds`, UPDATE each with new position index
- **Transaction**: Use `db.exec('BEGIN IMMEDIATE')` ... `db.exec('COMMIT')` for atomicity
- **Migration**: Handled separately in ticket 2.17

### SQL Schema Addition

```sql
CREATE TABLE IF NOT EXISTS priority_order (
  assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_priority_order_position ON priority_order(position);
```

---

## Code Changes

### New Files

- None

### Modified Files

- `src/backend/main/db/schema.sql` — add `priority_order` table + index
- `src/backend/main/db/mappers.ts` — add `mapPriorityOrderRow`, `mapPriorityOrderInput`
- `src/backend/main/db/repository.ts` — add `PriorityOrderRepository` class with methods above

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `priority_order` table created with correct schema on migration | Integration test |
| 2 | `getAll()` returns entries ordered by position ASC | Unit test |
| 3 | `upsert` inserts new or updates existing position | Unit test |
| 4 | `reorder([id3, id1, id2])` sets positions 0,1,2 respectively in single transaction | Unit test with mock DB |
| 5 | Deleting assignment cascades to priority_order | Integration test |
| 6 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- `reorder` receives full ordered list of assignment IDs — this is simpler than delta moves
- Position gaps should not occur in normal operation; `reorder` ensures contiguity
- If an assignment in `orderedAssignmentIds` doesn't exist in DB, skip silently (or log warning)
- `created_at`/`updated_at` use SQLite `datetime('now')` (UTC)
- This repository will be used by IPC handlers in ticket 2.2

---

## Release Summary

Add priority_order table and repository for custom assignment ordering