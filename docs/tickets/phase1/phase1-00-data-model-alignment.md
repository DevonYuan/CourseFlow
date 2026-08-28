# Ticket: phase1-00-data-model-alignment

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical (Blocking)  
**Estimated Effort:** 1 day

---

## Description

Align the shared types, IPC contracts, database schema, and repository mappers with the full data model required by Phase 1 tickets. This is a **blocking prerequisite** for all other Phase 1 tickets.

---

## Background

Phase 1 tickets were written against a richer data model than what exists in the current codebase (end of Phase 0). This ticket closes all gaps so subsequent tickets can proceed without type mismatches or missing fields.

---

## Requirements

### 1. Extend `src/backend/shared/types.ts`

**Current `Assignment`** (8 fields) → **Target `Assignment`** (20+ fields):

```typescript
// CURRENT (in codebase)
export interface Assignment {
  id: string;
  title: string;
  description: string;
  courseId: string;
  dueDate: string; // ISO 8601
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  source: 'manual' | 'ical';
  sourceUrl?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// TARGET (needed by Phase 1 tickets)
export interface Assignment {
  id: string; // Canvas assignment ID or generated
  title: string;
  description: string; // HTML from Canvas
  courseId: string; // Canvas course ID
  courseName: string; // Canvas course name
  courseColor: string; // Hex color from Canvas (e.g., "#e8a838")
  dueAt: string | null; // ISO 8601 (Canvas: due_at)
  unlockAt: string | null; // ISO 8601
  lockAt: string | null; // ISO 8601
  pointsPossible: number | null;
  submissionTypes: string[]; // e.g., ["online_text_entry", "online_upload"]
  workflowState: string; // "published", "unpublished", etc.
  htmlUrl: string; // Canvas assignment URL
  icalUid: string; // UID from iCal VEVENT
  priority: 'low' | 'medium' | 'high'; // Calculated: overdue→high, dueSoon→medium, else→low
  status: 'pending' | 'in_progress' | 'completed';
  source: 'manual' | 'ical';
  sourceUrl?: string; // iCal feed URL this came from
  rrule?: string; // RRULE string for recurring
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

**Current `AssignmentInput`** → **Target `AssignmentInput`** (for upsert):

- Should be `Partial<Assignment>` with `id` required
- All fields optional except `id`

**Current `AssignmentStatus`** → **Target**:

```typescript
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed';
```

**Current `Settings`** (7 fields) → **Target `Settings`** (10+ fields):

```typescript
// CURRENT
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  autoFetchIcal: boolean;
  icalFetchIntervalMinutes: number;
  defaultPriority: 'low' | 'medium' | 'high';
  showCompletedAssignments: boolean;
  notifyDueSoon: boolean;
  dueSoonThresholdHours: number;
}

// TARGET
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  autoFetchIcal: boolean;
  icalFetchIntervalMinutes: number;
  defaultPriority: 'low' | 'medium' | 'high';
  showCompletedAssignments: boolean;
  notifyDueSoon: boolean;
  dueSoonThresholdHours: number;
  // NEW fields needed by Phase 1:
  icalUrl: string; // User's Canvas iCal feed URL
  lastSyncAt: string | null; // ISO 8601, updated on successful import
  autoFetchIntervalMs: number; // Computed: icalFetchIntervalMinutes * 60 * 1000
}
```

**Current `ICalEvent`** uses `dtStart`/`dtEnd` (ISO strings) — **keep as-is**, but ensure tickets reference correct field names.

---

### 2. Update `src/backend/shared/ipc.ts`

**`IpcChannels['ical:import']` response** — add `updated` field:

```typescript
// CURRENT
'ical:import': {
  request: { events: ICalEvent[]; url: string };
  response: { imported: number; skipped: number };
}

// TARGET
'ical:import': {
  request: { events: ICalEvent[]; url: string };
  response: { imported: number; updated: number; skipped: number };
}
```

**Add/verify `DbChangedEvent`** in `IpcEvents`:

```typescript
export interface IpcEvents {
  'db:changed': {
    table: string;
    action: 'insert' | 'update' | 'delete';
    id: string;
  };
  'ical:progress': {
    stage: 'fetching' | 'parsing' | 'importing' | 'complete' | 'error';
    progress: number;
    message?: string;
  };
  'settings:changed': Settings;
}
```

---

### 3. Database Migration (`src/backend/main/db/schema.sql`)

Create migration script (v2) to add missing columns to `assignments` table:

```sql
-- Migration v2: Add missing Assignment columns
ALTER TABLE assignments ADD COLUMN course_name TEXT;
ALTER TABLE assignments ADD COLUMN course_color TEXT;
ALTER TABLE assignments ADD COLUMN due_at TEXT;
ALTER TABLE assignments ADD COLUMN unlock_at TEXT;
ALTER TABLE assignments ADD COLUMN lock_at TEXT;
ALTER TABLE assignments ADD COLUMN points_possible INTEGER;
ALTER TABLE assignments ADD COLUMN submission_types TEXT;  -- JSON array
ALTER TABLE assignments ADD COLUMN workflow_state TEXT;
ALTER TABLE assignments ADD COLUMN html_url TEXT;
ALTER TABLE assignments ADD COLUMN ical_uid TEXT UNIQUE;
ALTER TABLE assignments ADD COLUMN rrule TEXT;
ALTER TABLE assignments ADD COLUMN status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending';

-- Update existing rows: backfill status
UPDATE assignments SET status = 'pending' WHERE status IS NULL;

-- Add index for ical_uid lookups
CREATE INDEX IF NOT EXISTS idx_assignments_ical_uid ON assignments(ical_uid);
```

**Also add `settings` table columns** (if not present):

```sql
ALTER TABLE settings ADD COLUMN ical_url TEXT;
ALTER TABLE settings ADD COLUMN last_sync_at TEXT;
-- auto_fetch_interval_ms is computed, not stored
```

---

### 4. Update Repository Mappers (`src/backend/main/db/repository.ts`)

**`mapDbAssignmentToAssignment`** — full mapping (no lossy conversion):

```typescript
function mapDbAssignmentToAssignment(row: DbAssignmentRow): Assignment {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    courseId: row.course_id,
    courseName: row.course_name,
    courseColor: row.course_color,
    dueAt: row.due_at,
    unlockAt: row.unlock_at,
    lockAt: row.lock_at,
    pointsPossible: row.points_possible,
    submissionTypes: row.submission_types ? JSON.parse(row.submission_types) : [],
    workflowState: row.workflow_state,
    htmlUrl: row.html_url,
    icalUid: row.ical_uid,
    priority: row.priority,
    status: row.status,
    source: row.source,
    sourceUrl: row.source_url,
    rrule: row.rrule,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

**`mapAssignmentToDb`** — reverse mapping for upsert.

**Add `updateAssignmentStatus(id, status)`** method.

---

### 5. Update IPC Handlers (`src/backend/main/ipc-handlers.ts`)

- `ical:import` handler: return `{ imported, updated, skipped }`
- Ensure `settings:upsert` persists new fields (`icalUrl`, `lastSyncAt`)
- Ensure `db:changed` emitted with correct `table: 'assignments'` on all CRUD

---

### 6. Update Preload Bridge (`src/backend/preload/index.ts`)

Verify all channels exposed; add any missing from Ticket 1.0 changes.

---

## Acceptance Criteria

| #   | Criterion                                                          | Verification                            |
| --- | ------------------------------------------------------------------ | --------------------------------------- |
| 1   | `Assignment` type has all 20+ fields                               | TypeScript compiles, no `any`           |
| 2   | `Settings` type has `icalUrl`, `lastSyncAt`, `autoFetchIntervalMs` | TypeScript compiles                     |
| 3   | `AssignmentStatus` includes `'in_progress'`                        | TypeScript compiles                     |
| 4   | `ical:import` response includes `updated`                          | TypeScript compiles, handler returns it |
| 5   | Migration v2 runs successfully                                     | `pnpm db:migrate` (or manual test)      |
| 6   | Repository mappers are lossless                                    | Unit test: round-trip assignment        |
| 7   | All Phase 1 tickets TypeScript-compile against new types           | `pnpm typecheck` passes                 |
| 8   | Preload bridge exposes all updated channels                        | `window.api` has all methods            |

---

## Code Changes

### Modified Files

- `src/backend/shared/types.ts` — extend all types
- `src/backend/shared/ipc.ts` — update IPC contracts
- `src/backend/main/db/schema.sql` — add migration v2
- `src/backend/main/db/migrate.ts` — add migration runner logic
- `src/backend/main/db/repository.ts` — update mappers, add updateAssignmentStatus
- `src/backend/main/ipc-handlers.ts` — update handlers for new fields
- `src/backend/preload/index.ts` — verify/extend exposed API

### New Files

- `src/backend/main/db/migrations/002_add_assignment_fields.sql` — migration file
- `src/backend/main/db/__tests__/mappers.test.ts` — mapper round-trip tests

---

## Notes

- **Run this ticket FIRST** — all other Phase 1 tickets depend on it
- Migration should be idempotent (use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`)
- `autoFetchIntervalMs` is computed in getter, not stored — add getter to Settings type or compute in hook
- `courseColor` should be hex (e.g., `#e8a838`), not HSL — conversion happens in parser (Ticket 1.3)
- Priority calculation: overdue → high, due within threshold → medium, else low
- This ticket unblocks: 1.1 through 1.15

---

## Release Summary

Align data model across types, IPC, database, and repository to support full Phase 1 feature set
