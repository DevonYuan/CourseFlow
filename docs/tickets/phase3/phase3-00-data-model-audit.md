---
applyTo: 'docs/tickets/phase3/phase3-00-data-model-audit.md'
issue: 'N/A'
---

# phase3-00-data-model-audit — Data Model & IPC Audit for Detail/Sub-tasks/Notes

## Description

Before building any Phase 3 UI, audit the existing backend data layer (schema, types, repository, IPC, preload) for `SubTask` and `Note` entities against the Phase 3 UI requirements. The Phase 3 README notes that much of this was "scaffolded in Phases 0–2 and is **ready to use**," but the audit must **confirm** alignment and **fill any gaps** (e.g., sub-task ordering field, note timestamps, note model shape — single note vs. log entries) before the frontend depends on it. This is the **blocking prerequisite** for all other Phase 3 tickets.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Schema audit**: Verify `sub_tasks` and `notes` tables in SQLite match the current `src/backend/shared/types.ts` definitions. Check columns: `id`, `assignment_id`, `title`, `completed`, `position`, `created_at`, `updated_at` (SubTask); `assignment_id`, `content`, `updated_at` (Note — or `created_at`/`updated_at` if log entries). Confirm FK to `assignments(id)` with `ON DELETE CASCADE`.
- [ ] **Type audit**: Confirm `SubTask`, `SubTaskInput`, `Note`, `NoteInput` in `src/backend/shared/types.ts` have all fields the UI needs (e.g., `position` for ordering, `created_at` for note timestamps, `content` vs. `markdown` decision).
- [ ] **Repository audit**: Verify `src/backend/main/db/repository.ts` has CRUD for both entities: `listSubTasks(assignmentId)`, `upsertSubTask(input)`, `deleteSubTask(id)`, `toggleSubTask(id, completed)`, `listNotes(assignmentId)`, `upsertNote(input)`, `deleteNote(id)` (or `deleteNote(assignmentId)` if 1:1). Check return types match IPC payloads.
- [ ] **IPC audit**: Confirm `src/backend/main/ipc-handlers.ts` implements all channels from `src/backend/shared/ipc.ts`: `db:subtasks:list`, `db:subtasks:upsert`, `db:subtasks:delete`, `db:subtasks:toggle`, `db:notes:list`, `db:notes:upsert`, `db:notes:delete`. Verify request/response payloads match `IpcChannels` types. Verify `IpcResult<T>` wrapper used correctly.
- [ ] **Preload audit**: Confirm `src/backend/preload/index.ts` exposes typed `window.api.db.subtasks.*` and `window.api.db.notes.*` matching the IPC channels. Verify no `any` types leak.
- [ ] **Event audit**: Verify `db:changed` events are emitted for `sub_tasks` and `notes` tables (table name, action, id) so the detail view can subscribe for live updates (Ticket 3.2).
- [ ] **Migration (if needed)**: If gaps are found (missing columns, wrong types, missing indexes), create a migration file (e.g., `migration-004-phase3-audit.ts` or next version) and ensure it runs on app startup via the migration runner.
- [ ] **Decision: Note model shape**: Resolve and document whether `notes` is **one note per assignment** (1:1, `assignment_id` as PK) or **multiple timestamped log entries** (1:N, own `id` PK). The Phase 3 README says "multiple entries (matches 'progress logging' language) unless schema audit shows otherwise." Record the decision in `docs/architecture/data-model.md` and update types/schema accordingly.
- [ ] **Decision: Sub-task ordering**: Confirm `position` column exists and is used for display order. If missing, add it.
- [ ] **Decision: Note timestamps**: Confirm `created_at` and `updated_at` exist on notes (for "newest-first log with timestamps" in Ticket 3.7). If only `updated_at` exists, add `created_at`.
- [ ] **Protected fields check**: Verify the iCal import logic (Phase 1) explicitly excludes `sub_tasks` and `notes` tables from any upsert/prune — they must never be touched by re-import. Add a regression test note.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Zero breaking changes to IPC without versioning**: If IPC payloads change, follow the versioning strategy in `docs/architecture/ipc-contract.md` (additive only, new namespace for breaking changes). Phase 3 is pre-launch, so additive changes are fine; just keep types in sync.
- [ ] **Shared types are pure TS**: `src/backend/shared/types.ts` must have **zero** Electron/Node imports. Verify this hasn't drifted.
- [ ] **Migration runner is idempotent**: Any new migration must be safe to run multiple times (check `schema_version` table).
- [ ] **ON DELETE CASCADE**: Sub-tasks and notes must cascade delete when the parent assignment is deleted. Verify FK definitions.
- [ ] **Indexes**: Ensure `idx_subtask_assignment` on `sub_tasks(assignment_id)` exists. For notes, if 1:N, add index on `notes(assignment_id)`; if 1:1, PK covers it.
- [ ] **Web Crypto for settings only**: Sub-tasks and notes are not encrypted (unlike `ical_url`). Do not add encryption here.
- [ ] **Consistency with existing patterns**: Follow the exact same patterns used for `Assignment` / `PriorityOrder` in repository, IPC, and preload (naming, error codes, `IpcResult` wrapper, event emission).

## Code Changes

> List any source code files that need changes and describe the required changes.

### Backend — Shared Types

| File | Change |
|------|--------|
| `src/backend/shared/types.ts` | Audit and update `SubTask`, `SubTaskInput`, `Note`, `NoteInput`. Add missing fields (`position`, `created_at` on Note, etc.). Document the note model decision (1:1 vs 1:N) in a JSDoc comment. |

### Backend — Database Schema & Migrations

| File | Change |
|------|--------|
| `src/backend/main/db/schema.ts` (or migration files) | Verify `CREATE TABLE` statements for `sub_tasks` and `notes`. Add missing columns (`position`, `created_at`). Ensure FKs with `ON DELETE CASCADE`. Add indexes. |
| `src/backend/main/db/migrations/*.ts` | Create new migration file if schema changes needed (e.g., `004_add_subtask_position_note_created_at.ts`). |

### Backend — Repository

| File | Change |
|------|--------|
| `src/backend/main/db/repository.ts` | Audit all SubTask/Note methods. Add missing methods. Ensure `toggleSubTask` uses `db:subtasks:toggle` IPC pattern. Verify return types. |

### Backend — IPC Handlers

| File | Change |
|------|--------|
| `src/backend/main/ipc-handlers.ts` | Audit handlers for all 7 channels. Ensure they call repository methods, wrap in `IpcResult`, emit `db:changed` events on mutations. |

### Backend — Preload

| File | Change |
|------|--------|
| `src/backend/preload/index.ts` | Audit exposed API. Ensure `window.api.db.subtasks.*` and `window.api.db.notes.*` are fully typed and match IPC channels. |

### Backend — IPC Contract (Source of Truth)

| File | Change |
|------|--------|
| `src/backend/shared/ipc.ts` | Verify `IpcChannels` and `IpcEvents` definitions match the handlers and preload. Update if types changed. |

### Documentation

| File | Change |
|------|--------|
| `docs/architecture/data-model.md` | Update SubTask/Note entity definitions with final columns, relationships, indexes. Record note model decision (1:1 vs 1:N). Document protected-fields rule for iCal re-import. |
| `docs/architecture/ipc-contract.md` | Update channel table if any payloads changed. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Schema matches types**: SQLite tables for `sub_tasks` and `notes` have columns exactly matching `SubTask`/`Note` TypeScript interfaces (verified by running migration on clean DB and inspecting schema).
- [ ] **All IPC channels work**: Each of the 7 channels (`db:subtasks:list`, `upsert`, `delete`, `toggle`, `db:notes:list`, `upsert`, `delete`) can be invoked from the renderer via `window.api` and returns correctly typed `IpcResult`.
- [ ] **Preload types are exact**: TypeScript compiles with no `any` in the preload exposure; `window.api.db.subtasks.list()` returns `Promise<IpcResult<SubTask[]>>`, etc.
- [ ] **Events fire**: After any sub-task/note mutation via IPC, `window.api.onDbChanged` callback receives `{ table: 'sub_tasks' | 'notes', action: 'insert'|'update'|'delete', id: string }`.
- [ ] **Migration runs cleanly**: Fresh app install (no DB) runs all migrations including any new one and ends at the expected schema version. Existing DB upgrades without data loss.
- [ ] **Cascade delete works**: Deleting an assignment via `db:assignments:delete` removes its sub-tasks and notes (verify FK cascade).
- [ ] **Indexes exist**: `PRAGMA index_list('sub_tasks')` shows `idx_subtask_assignment`; notes have appropriate index per model decision.
- [ ] **Protected fields documented**: `docs/architecture/data-model.md` explicitly states sub-tasks and notes are never modified by iCal import.
- [ ] **Note model decision recorded**: `docs/architecture/data-model.md` clearly states whether notes are 1:1 or 1:N per assignment, with rationale.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes across all projects (main, preload, renderer, shared).
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **This ticket unblocks all of Phase 3**. Do not start Tickets 3.1–3.10 until this audit is complete and any migrations are merged.
- **Existing scaffolding**: The Phase 3 README lists existing files that *should* already have this. The audit is about **verifying** and **completing** — not rebuilding from scratch. Expect most pieces to be 80-90% there.
- **Note model decision impact**: If notes are 1:N (log entries), the `notes` table needs its own `id` PK, `created_at`, and the IPC `db:notes:delete` takes a note `id` (not `assignment_id`). If 1:1, `assignment_id` is PK and delete takes `assignment_id`. Decide **before** finalizing types/IPC.
- **Sub-task `position`**: If the column doesn't exist, add it as `INTEGER NOT NULL DEFAULT 0` and backfill with sequential values per `assignment_id`.
- **Test approach**: Unit test the repository methods directly (Vitest in `src/backend/shared/__tests__/` or `src/backend/main/__tests__/`). Integration test the IPC handlers via the preload bridge in a renderer test context.
- **Playwright not needed here**: This is a backend/data-layer ticket. E2E tests for the UI will live in Tickets 3.1+.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Audit and align SubTask/Note schema, types, repo, IPC, and preload for Phase 3; add missing columns (position, created_at); run migration.