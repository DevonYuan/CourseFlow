# Ticket: phase1-19-database-migration

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Create and run the database migration (v2) to add all missing columns to the `assignments` and `settings` tables as defined in Ticket 1.0 (Data Model Alignment).

---

## PREREQUISITE

**This ticket depends on Ticket 1.0 (Data Model Alignment) being completed first.**

Ticket 1.0 defines the exact migration SQL. This ticket implements and runs it.

---

## Requirements

### Functional

- [ ] **Migration File**: Create `src/backend/main/db/migrations/002_add_assignment_fields.sql` with:
  - All missing `assignments` columns (course_name, course_color, due_at, unlock_at, lock_at, points_possible, submission_types, workflow_state, html_url, ical_uid, rrule, status)
  - All missing `settings` columns (ical_url, last_sync_at)
  - Index on `ical_uid` for deduplication
  - Idempotent (uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`)

- [ ] **Migration Runner**: Update `src/backend/main/db/migrate.ts` to:
  - Run migrations in order (v1 → v2)
  - Track applied migrations in `schema_migrations` table
  - Be idempotent (safe to re-run)

- [ ] **Run Migration**: Execute against development database
- [ ] **Verify Schema**: `PRAGMA table_info(assignments)` shows all columns

### Non-Functional

- [ ] **Safety**: Migration wrapped in transaction (or individual statements)
- [ ] **Rollback**: Document rollback plan (drop columns) — not implemented, just documented
- [ ] **Data Preservation**: Existing data not lost; `status` backfilled to `'pending'`

---

## Designs & Constraints

- **Location**:
  - Migration: `src/backend/main/db/migrations/002_add_assignment_fields.sql`
  - Runner: `src/backend/main/db/migrate.ts`
- **Database**: SQLite with `node:sqlite` (DatabaseSync)
- **Migration Table**: `schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT)`

### Migration SQL (from Ticket 1.0)

```sql
-- Migration v2: Add missing Assignment columns
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assignments table additions
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS course_name TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS course_color TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_at TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS unlock_at TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lock_at TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS points_possible INTEGER;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submission_types TEXT;  -- JSON array
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS workflow_state TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS html_url TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS ical_uid TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS rrule TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending';

-- Backfill status for existing rows
UPDATE assignments SET status = 'pending' WHERE status IS NULL;

-- Unique index for ical_uid (deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_ical_uid ON assignments(ical_uid);

-- Settings table additions
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ical_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS last_sync_at TEXT;

-- Record migration
INSERT OR IGNORE INTO schema_migrations (version) VALUES (2);
```

---

## Code Changes

### New Files

- `src/backend/main/db/migrations/002_add_assignment_fields.sql`

### Modified Files

- `src/backend/main/db/migrate.ts` — add migration v2 to runner
- `src/backend/main/db/connection.ts` — ensure migrations run on startup (or add CLI command)

---

## Acceptance Criteria

| #   | Criterion                               | Verification                           |
| --- | --------------------------------------- | -------------------------------------- |
| 1   | Migration file created with correct SQL | File exists, SQL valid                 |
| 2   | Migration runner executes v2 after v1   | Run migrate, check `schema_migrations` |
| 3   | All columns present in `assignments`    | `PRAGMA table_info(assignments)`       |
| 4   | All columns present in `settings`       | `PRAGMA table_info(settings)`          |
| 5   | `ical_uid` unique index exists          | `.indexes` command                     |
| 6   | Existing data preserved                 | Count rows before/after                |
| 7   | `status` backfilled to `'pending'`      | Query `SELECT status FROM assignments` |
| 8   | App starts without schema errors        | `pnpm dev`                             |

---

## Notes

- Run this **immediately after Ticket 1.0** — before any other Phase 1 tickets that use the new columns
- Migration must be idempotent for CI/CD (safe to run multiple times)
- Consider adding a `pnpm db:migrate` script to package.json

---

## Release Summary

Apply database migration v2 to add all Phase 1 required columns
