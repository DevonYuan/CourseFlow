# Ticket: phase1-04-ical-dedup

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Implement deduplication logic for iCal import in the assignments repository. On import, match by `ical_uid` (stored on Assignment). Update existing if `updated_at` newer; insert new. Return `{ imported: number; skipped: number; updated: number }`.

**PREREQUISITE**: Ticket 1.0 (Data Model Alignment) must add `ical_uid`, `status`, `source`, `priority`, `rrule`, `sourceUrl` columns to the `assignments` table and extend `AssignmentInput` type.

---

## Requirements

### Functional

- [ ] `importAssignments(assignments: AssignmentInput[]): Promise<ImportResult>` in repository
- [ ] **Match key**: `ical_uid` (unique constraint on `assignments.ical_uid` — already exists in schema)
- [ ] **Conflict resolution**:
  - If `ical_uid` not exists → INSERT (count as `imported`)
  - If `ical_uid` exists AND incoming `updatedAt` > stored `updated_at` → UPDATE (count as `updated`)
  - If `ical_uid` exists AND incoming `updatedAt` <= stored `updated_at` → SKIP (count as `skipped`)
- [ ] **Preserve local user data on UPDATE**: Never overwrite user-edited fields on re-import
  - Protected: `description`, `status` (if `'completed'` or `'archived'`), `priority` (user drag-drop order)
  - Notes and subtasks are in separate tables — not affected by assignment UPDATE
- [ ] Return `ImportResult = { imported: number; skipped: number; updated: number }`
- [ ] Transactional — all or nothing
- [ ] Emit `db:changed` events for each inserted/updated assignment (for UI auto-refresh)

### Non-Functional

- [ ] Uses prepared statements (cached)
- [ ] Zero `any` — typed `AssignmentInput` and `ImportResult`
- [ ] WAL mode compatible (concurrent reads via IPC)
- [ ] Unit tests with various conflict scenarios

---

## Designs & Constraints

- **Location**: `src/backend/main/db/repository.ts` — add `importAssignments` method
- **Export**: `importAssignments`, `ImportResult` type
- **Schema dependency**: `assignments` table has `UNIQUE(ical_uid)` (from Phase 0)
- **Prerequisite**: Ticket 1.0 adds missing columns (`status`, `source`, `priority`, `rrule`, `sourceUrl`)

### `ImportResult` Type

```typescript
export interface ImportResult {
  imported: number;
  skipped: number;
  updated: number;
}
```

### Protected Fields (Never Overwritten on Re-import)

| Field         | Reason                                           | Table         |
| ------------- | ------------------------------------------------ | ------------- |
| `description` | User may have edited Canvas HTML description     | `assignments` |
| `status`      | User's completion state (`completed`/`archived`) | `assignments` |
| `priority`    | User's manual drag-drop order                    | `assignments` |

### Updateable Fields (Safe to Overwrite from Canvas)

| Field                   | Reason                               | Table         |
| ----------------------- | ------------------------------------ | ------------- |
| `due_at`                | Due date may change                  | `assignments` |
| `title`                 | Assignment title may be corrected    | `assignments` |
| `workflow_state`        | Submission status from Canvas        | `assignments` |
| `html_url`              | Canvas URL may change                | `assignments` |
| `course_color`          | Course color may update              | `assignments` |
| `points_possible`       | Points may be adjusted               | `assignments` |
| `submission_types`      | Submission types may change          | `assignments` |
| `lock_at` / `unlock_at` | Availability dates may change        | `assignments` |
| `rrule`                 | Recurrence rule may be added/changed | `assignments` |

---

## Code Changes

### Modified Files

- `src/backend/main/db/repository.ts` — add `importAssignments` method
- `src/backend/main/db/__tests__/repository.import.test.ts` — integration tests

### New Types (in `src/backend/shared/types.ts`)

- `ImportResult` interface

---

## Acceptance Criteria

| #   | Criterion                                                                   | Verification                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | New `ical_uid` → INSERT, count as `imported`                                | Test with fresh assignments                             |
| 2   | Existing `ical_uid`, newer `updatedAt` → UPDATE, count as `updated`         | Test with modified due date                             |
| 3   | Existing `ical_uid`, older/equal `updatedAt` → SKIP, count as `skipped`     | Test with unchanged data                                |
| 4   | On UPDATE, protected fields (`description`, `status`, `priority`) preserved | Test re-import with local edits                         |
| 5   | Returns correct counts for mixed batch                                      | Test with 3 new, 2 updated, 1 skipped                   |
| 6   | Transactional — partial failure rolls back all                              | Test with forced error mid-batch                        |
| 7   | Emits `db:changed` for each insert/update                                   | Verify event payload                                    |
| 3   | Existing `ical_uid`, older/equal `updatedAt` → SKIP, count as `skipped`     | Test with unchanged assignment                          |
| 4   | Protected fields preserved on UPDATE                                        | Test: set local notes, re-import, verify notes intact   |
| 5   | Updateable fields refreshed on UPDATE                                       | Test: change dueAt in source, re-import, verify updated |
| 6   | Transactional — partial failure rolls back                                  | Test: simulate constraint violation mid-batch           |
| 7   | Emits `db:changed` events for each change                                   | Verify event bus receives correct payloads              |
| 8   | All tests pass (`pnpm test`)                                                | CI run                                                  |

---

## Notes

- This is called by `ical:import` IPC handler (ticket 1.5)
- The `updatedAt` comparison uses the `updated_at` column (Unix ms) set by repository on every write
- For MVP, `updatedAt` in `AssignmentInput` comes from `Date.now()` at import time; Phase 2 may use `DTSTAMP` from iCal
- Conflict resolution strategy documented in `docs/architecture/data-model.md`

---

## Release Summary

Add deduplication logic for iCal import: upsert by ical_uid, preserve local user data
