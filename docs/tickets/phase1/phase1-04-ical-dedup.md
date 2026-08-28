# Ticket: phase1-04-ical-dedup

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Implement deduplication logic for iCal import in the assignments repository. On import, match by `ical_uid` (stored on Assignment). Update existing if `updated_at` newer; insert new. Return `{ imported: number; skipped: number; updated: number }`.

---

## Requirements

### Functional

- [ ] `importAssignments(assignments: AssignmentInput[]): Promise<ImportResult>` in repository
- [ ] **Match key**: `ical_uid` (unique constraint on `assignments.ical_uid`)
- [ ] **Conflict resolution**:
  - If `ical_uid` not exists → INSERT (count as `imported`)
  - If `ical_uid` exists AND incoming `updatedAt` > stored `updated_at` → UPDATE (count as `updated`)
  - If `ical_uid` exists AND incoming `updatedAt` <= stored `updated_at` → SKIP (count as `skipped`)
- [ ] **Preserve local user data on UPDATE**: Never overwrite `description`, `notes`, `subtasks`, `priority`, `status` (if `completed`) on re-import — only update `dueAt`, `title`, `workflowState`, `htmlUrl`, `courseColor`, `pointsPossible`, `submissionTypes`, `lockAt`, `unlockAt`, `rrule`
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
- **Schema dependency**: `assignments` table has `UNIQUE(ical_uid)` (from Phase 0.3)

### `ImportResult` Type

```typescript
export interface ImportResult {
  imported: number;
  skipped: number;
  updated: number;
}
```

### Protected Fields (Never Overwritten on Re-import)

| Field         | Reason                                             |
| ------------- | -------------------------------------------------- |
| `description` | User may have edited Canvas HTML description       |
| `notes`       | User's personal notes (Markdown)                   |
| `subtasks`    | User-created checklist items                       |
| `priority`    | User's manual drag-drop order                      |
| `status`      | User's completion state (`completed` must persist) |

### Updateable Fields (Safe to Overwrite from Canvas)

| Field                 | Reason                               |
| --------------------- | ------------------------------------ |
| `dueAt`               | Due date may change                  |
| `title`               | Assignment title may be corrected    |
| `workflowState`       | Submission status from Canvas        |
| `htmlUrl`             | Canvas URL may change                |
| `courseColor`         | Course color may update              |
| `pointsPossible`      | Points may be adjusted               |
| `submissionTypes`     | Submission types may change          |
| `lockAt` / `unlockAt` | Availability dates may change        |
| `rrule`               | Recurrence rule may be added/changed |

---

## Code Changes

### Modified Files

- `src/backend/main/db/repository.ts` — add `importAssignments` method
- `src/backend/main/db/__tests__/repository.import.test.ts` — integration tests

### New Types (in `src/backend/shared/types.ts` or repository file)

- `ImportResult` interface

---

## Acceptance Criteria

| #   | Criterion                                                               | Verification                                            |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | New `ical_uid` → INSERT, count as `imported`                            | Test with fresh assignments                             |
| 2   | Existing `ical_uid`, newer `updatedAt` → UPDATE, count as `updated`     | Test with modified due date                             |
| 3   | Existing `ical_uid`, older/equal `updatedAt` → SKIP, count as `skipped` | Test with unchanged assignment                          |
| 4   | Protected fields preserved on UPDATE                                    | Test: set local notes, re-import, verify notes intact   |
| 5   | Updateable fields refreshed on UPDATE                                   | Test: change dueAt in source, re-import, verify updated |
| 6   | Transactional — partial failure rolls back                              | Test: simulate constraint violation mid-batch           |
| 7   | Emits `db:changed` events for each change                               | Verify event bus receives correct payloads              |
| 8   | All tests pass (`pnpm test`)                                            | CI run                                                  |

---

## Notes

- This is called by `ical:import` IPC handler (ticket 1.5)
- The `updatedAt` comparison uses the `updated_at` column (Unix ms) set by repository on every write
- For MVP, `updatedAt` in `AssignmentInput` comes from `Date.now()` at import time; Phase 2 may use `DTSTAMP` from iCal
- Conflict resolution strategy documented in `docs/architecture/data-model.md`

---

## Release Summary

Add deduplication logic for iCal import: upsert by ical_uid, preserve local user data
