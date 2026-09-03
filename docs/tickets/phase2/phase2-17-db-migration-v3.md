---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-17-db-migration-v3

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Create and run database migration v3 to add `priority_order` table and any new indexes. Ensure migration is idempotent and runs on app startup via existing migration runner.

---

## Requirements

### Functional

- [ ] Migration file: `src/backend/main/db/migrations/003_priority_order.sql`
- [ ] Creates `priority_order` table:
  ```sql
  CREATE TABLE IF NOT EXISTS priority_order (
    assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_priority_order_position ON priority_order(position);
  ```
- [ ] Migration runner (Phase 0 ticket 0.3) executes this on startup
- [ ] Idempotent: safe to run multiple times (IF NOT EXISTS)
- [ ] No data loss — additive only

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Migration runs in transaction (atomic)
- [ ] Version tracked in `schema_version` table (or PRAGMA user_version)
- [ ] Rollback not required (forward-only migrations)

---

## Designs & Constraints

- **Migration system**: From Phase 0 — `src/backend/main/db/migrate.ts` runs migrations on startup
- **Naming**: `003_priority_order.sql` (sequential after Phase 1 v2)
- **Location**: `src/backend/main/db/migrations/`
- **Runner**: Reads migration files in order, executes if version < target

### Migration File Content

```sql
-- Migration 003: Add priority_order table for custom assignment ordering
-- Date: 2026-09-02

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS priority_order (
  assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_priority_order_position ON priority_order(position);

-- Update schema version
PRAGMA user_version = 3;

COMMIT;
```

---

## Code Changes

### New Files

- `src/backend/main/db/migrations/003_priority_order.sql`

### Modified Files

- `src/backend/main/db/migrate.ts` — ensure migration runner picks up v3 (should be automatic)

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Fresh app install → priority_order table created | Manual test (delete DB, restart) |
| 2 | Existing v2 DB → migration runs, table added | Manual test (copy v2 DB, restart) |
| 3 | Table has correct columns, FK, index | SQLite inspector |
| 4 | Re-running migration doesn't error | Manual test (restart twice) |
| 5 | Schema version updated to 3 | PRAGMA user_version |
| 6 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- This migration depends on `assignments` table existing (Phase 0/1)
- FK `ON DELETE CASCADE` ensures priority entries cleaned up when assignment deleted
- No seed data needed — priority entries created on first drag-drop or import
- If Phase 1 migration (v2) not yet run, runner will execute v2 then v3 in order

---

## Release Summary

Add database migration v3 for priority_order table with FK cascade and position index