---
applyTo: 'docs/tickets/phase3/phase3-08-cascade-safety.md'
issue: 'N/A'
---

# phase3-08-cascade-safety — Delete & Sync Safety

## Description

Verify and enforce safety guarantees for sub-tasks and notes when assignments are deleted or re-imported via iCal sync. This ticket ensures: (1) deleting an assignment cascades to remove its sub-tasks and notes via FK `ON DELETE CASCADE`; (2) iCal re-import **never** touches sub-tasks or notes (protected fields); (3) manually created assignments (source `manual`) also get the full detail view with sub-tasks/notes. This is a backend/data-integrity ticket with frontend verification.

**Prerequisite**: Ticket 3.0 (audit) must be complete — schema, FKs, and IPC contracts are verified. Tickets 3.1 (detail route) and 3.3 (sub-task list) should be functional for manual testing.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Cascade delete verification**: Confirm that `DELETE FROM assignments WHERE id = ?` triggers `ON DELETE CASCADE` on `sub_tasks` and `notes` tables. No orphaned sub-tasks/notes should remain.
- [ ] **Frontend delete integration**: When the user deletes an assignment from the list (existing Phase 1 delete action), verify the IPC handler calls `db:assignments:delete` which cascades. The UI should not need to manually delete sub-tasks/notes.
- [ ] **iCal re-import protection**: Verify the import pipeline (`ical:import` → `importAssignments` → repository upsert) **only** updates assignment fields (`title`, `due_at`, `workflow_state`, `description`, `html_url`, `points_possible`, `submission_types`, `unlock_at`, `lock_at`, `course_name`, `course_color`). It must **never** insert/update/delete rows in `sub_tasks` or `notes`.
- [ ] **Protected fields documented**: In `docs/architecture/data-model.md`, explicitly list sub-tasks and notes as "protected from iCal re-import" with a note that they are user-owned data.
- [ ] **Regression test for re-import**: Add a unit/integration test that: creates assignment with sub-tasks/notes → runs iCal import with same `ical_uid` → asserts sub-tasks/notes unchanged.
- [ ] **Manual assignments get detail view**: Assignments with `source = 'manual'` (created via UI, not iCal) must be clickable and open the same detail view (`/assignments/:id`) with full sub-task/note support. Verify no iCal-specific fields block the detail view.
- [ ] **Manual assignment creation**: Ensure the "Create assignment" flow (if exists) or manual entry in Settings creates assignments with `source = 'manual'` and no `ical_uid`. These should work seamlessly with sub-tasks/notes.
- [ ] **Sync status reflects protected data**: The sync status indicator (Phase 1/2) should not imply that sub-tasks/notes are synced. They are local-only. No UI change needed, but verify no misleading messaging.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **FK cascade is the source of truth**: Do not implement manual cascade deletion in the repository or IPC handler. Rely on SQLite `ON DELETE CASCADE`. Verify the FK definitions in the migration/schema.
- [ ] **Import pipeline field allowlist**: The `importAssignments` function (or repository upsert) should use an explicit allowlist of columns to update. Any column not on the allowlist (including sub-task/note tables) is never touched.
- [ ] **`ical_uid` only for iCal assignments**: Manual assignments have `ical_uid = NULL`. The deduplication logic in the import pipeline must only match on `ical_uid` when it's non-null. Manual assignments are never deduplicated against iCal.
- [ ] **`source` field semantics**: `source = 'ical'` → came from iCal, has `ical_uid`, `source_url`. `source = 'manual'` → user-created, no `ical_uid`, `source_url = NULL`. Both support sub-tasks/notes equally.
- [ ] **No "merge" logic for manual + iCal**: If a user manually creates an assignment that later appears in iCal, they become two separate assignments. This is acceptable for Phase 3. Future deduplication UI can be added later.
- [ ] **Settings/UI for manual assignments**: If not already present, a simple "Add manual assignment" button in the list (or Settings) should create a minimal assignment with `source = 'manual'`. This may be a separate small feature; at minimum, verify the detail view works for existing manual assignments.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Backend — Database Schema / Migrations

| File                                  | Change                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/main/db/migrations/*.ts` | Verify FK definitions: `sub_tasks.assignment_id REFERENCES assignments(id) ON DELETE CASCADE`, `notes.assignment_id REFERENCES assignments(id) ON DELETE CASCADE`. If missing, create migration to add. |

### Backend — Repository / Import Pipeline

| File                                | Change                                                                                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/main/db/repository.ts` | Verify `upsertAssignment` uses an explicit column allowlist. Ensure `sub_tasks` and `notes` are not in the allowlist. Verify `deleteAssignment` does a simple `DELETE FROM assignments WHERE id = ?` (cascade handles the rest). |
| `src/backend/main/ical/import.ts`   | Verify the import logic only calls `repository.upsertAssignment` with the allowlisted fields. No calls to sub-task/note repo methods.                                                                                            |

### Backend — IPC Handlers

| File                               | Change                                                                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/main/ipc-handlers.ts` | Verify `db:assignments:delete` handler calls `repository.deleteAssignment(id)` and emits `db:changed` for `assignments` (cascade deletions of sub-tasks/notes will emit their own `db:changed` events if triggers fire — verify). |

### Frontend (Renderer)

| File                                                        | Change                                                                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/components/assignments/AssignmentRow.tsx` | Verify delete button calls `window.api.db.assignments.delete(id)` only. No manual sub-task/note cleanup.                                                       |
| `src/frontend/src/pages/AssignmentDetailPage.tsx`           | Verify no iCal-specific assumptions (e.g., requiring `ical_uid` or `source_url`). Works for `source = 'manual'`.                                               |
| `src/frontend/src/stores/assignmentStore.ts`                | Verify `deleteAssignment` action only calls the delete IPC. Optimistic removal of assignment from list; sub-tasks/notes removed via `db:changed` subscription. |

### Documentation

| File                              | Change                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/data-model.md` | Add "Protected from iCal re-import" section for SubTask and Note entities. Document `source` field semantics and manual assignment support. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Cascade delete works**: Delete an assignment with sub-tasks and notes via UI → assignment, sub-tasks, and notes all removed from DB. Verify with `SELECT * FROM sub_tasks WHERE assignment_id = ?` returns empty.
- [ ] **No orphaned data**: After cascade delete, no rows in `sub_tasks` or `notes` reference the deleted assignment ID.
- [ ] **Re-import preserves sub-tasks**: Create assignment via iCal → add sub-tasks/notes in UI → run iCal sync again → sub-tasks/notes unchanged (titles, completion, content, order).
- [ ] **Re-import preserves notes**: Same as above for notes (content, timestamps).
- [ ] **Re-import updates only allowed fields**: After re-import, `title`, `due_at`, `workflow_state`, `description`, etc. reflect iCal data; sub-tasks/notes untouched.
- [ ] **Manual assignment detail view works**: Create manual assignment (or use existing) → click to open detail → sub-task list renders → can add/complete/delete sub-tasks → can add/edit/delete notes.
- [ ] **Manual assignment has no ical_uid**: Verify manual assignments have `ical_uid = NULL` and `source = 'manual'`.
- [ ] **Deduplication ignores manual**: iCal import with same title/course as a manual assignment creates a separate iCal assignment (does not merge).
- [ ] **db:changed events fire for cascade**: Deleting an assignment emits `db:changed` for `assignments` (action: delete). Sub-task/note deletions also emit events (verify SQLite triggers or app-level emission).
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **SQLite triggers for cascade events**: SQLite `ON DELETE CASCADE` does **not** fire `DELETE` triggers on the child tables by default. The `db:changed` events for sub-tasks/notes may not fire automatically on cascade. Options:
  1. Accept that cascade deletions don't emit `db:changed` for children (the assignment deletion event is enough for UI to clear the detail view).
  2. Add explicit `DELETE` triggers on `sub_tasks`/`notes` to emit events (complex).
  3. In the repository `deleteAssignment`, manually delete sub-tasks/notes first (explicit, emits events), then delete assignment.

  **Recommendation**: Option 3 (explicit delete in repo) for reliable `db:changed` events. Update `repository.deleteAssignment` to: `DELETE FROM sub_tasks WHERE assignment_id = ?; DELETE FROM notes WHERE assignment_id = ?; DELETE FROM assignments WHERE id = ?;` — each emits `db:changed`. This is cleaner than relying on FK cascade for events.

- **Import pipeline allowlist**: The current `upsertAssignment` likely does `INSERT OR REPLACE` or `UPSERT` with all columns. Change to explicit column list: `title, due_at, workflow_state, description, html_url, points_possible, submission_types, unlock_at, lock_at, course_name, course_color, updated_at`. Exclude: `id`, `canvas_id`, `ical_uid`, `source`, `source_url`, `created_at`, `status` (user may have marked complete), `priority` (handled separately).

- **Testing**:
  - Unit: `repository.deleteAssignment` (verify cascade or explicit deletes), `importAssignments` (verify allowlist, sub-tasks/notes untouched).
  - Integration: Full iCal import → add sub-tasks → re-import → verify.
  - E2E: Playwright test in `src/frontend/test/cascade-safety.spec.ts` — delete assignment with sub-tasks, re-import preserves sub-tasks, manual assignment detail view.

- **Future**: If Phase 6 (multi-calendar) adds `source_id` FK to calendars, the same protected-fields logic applies per calendar source.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Verify cascade delete for sub-tasks/notes; protect sub-tasks/notes from iCal re-import; ensure manual assignments work in detail view.
