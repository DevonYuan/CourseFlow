---
applyTo: 'docs/tickets/phase3/phase3-10-tests-docs.md'
issue: 'N/A'
---

# phase3-10-tests-docs — Tests & Documentation

## Description

Add comprehensive test coverage for all Phase 3 features and update documentation to reflect the new productivity depth capabilities. This ticket ensures: unit tests for backend repositories and IPC handlers, component tests for frontend sub-task/notes/progress UI, end-to-end Playwright tests for critical user flows, and updates to architecture docs, IPC contract, and root README.

**Prerequisite**: All Phase 3 feature tickets (3.1–3.9) should be functionally complete. This ticket finalizes quality assurance and documentation.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Backend unit tests** (Vitest, `src/backend/`):
  - `repository.ts`: `listSubTasks`, `upsertSubTask`, `deleteSubTask`, `toggleSubTask`, `listNotes`, `upsertNote`, `deleteNote`, `deleteAssignment` (cascade verification).
  - `import.ts`: `importAssignments` preserves sub-tasks/notes (regression test for protected fields).
  - `ipc-handlers.ts`: All 7 sub-task/note channels return correct `IpcResult`, emit `db:changed`.
  - Run with `pnpm test -- --pool=forks --poolOptions.forks.singleFork` (single-threaded per project guidelines).
- [ ] **Frontend component tests** (Vitest + React Testing Library, `src/frontend/src/`):
  - `SubTaskList`: renders list, empty state, loading skeleton.
  - `SubTaskRow`: checkbox toggle, delete button, keyboard activation.
  - `SubTaskAddInput`: Enter saves, Escape clears, validation (empty, max length).
  - `DeleteConfirmModal`: open/close, focus trap, confirm/cancel, focus restoration.
  - `AllCompletePrompt`: appears when all complete, Mark Complete works, Dismiss works, reappears on change.
  - `ProgressBar`: all sizes, labels, colors, ARIA attributes, reduced motion.
  - `NotesEditor`: save/cancel, Ctrl+Enter, Escape, validation.
  - `NoteEntry`: displays content/timestamp, delete button.
  - `AssignmentDetailPage`: loads assignment, renders header/description/progress/sub-tasks/notes, error/not-found states.
- [ ] **Frontend hook tests** (Vitest):
  - `useSubTasks`: fetch, add, delete, toggle, optimistic updates, rollback, live updates via `db:changed` mock.
  - `useSubTaskProgress`: calculates counts/percentage, `isAllComplete`, updates on store changes.
  - `useFocusRestoration`: saves/restores focus.
- [ ] **E2E tests** (Playwright, `src/frontend/test/`):
  - `subtasks.spec.ts`: Full sub-task flow — add multiple, toggle completion, delete with confirmation, verify persistence after reload, progress indicator updates.
  - `notes.spec.ts`: Full notes flow — add note, edit note, delete note, verify timestamps, verify persistence.
  - `detail-view.spec.ts`: Navigate from list to detail, back navigation restores focus, deep link works, manual assignment detail view works.
  - `cascade-safety.spec.ts`: Delete assignment with sub-tasks/notes cascades, re-import preserves sub-tasks/notes, manual assignment not merged.
  - `accessibility.spec.ts`: axe scan on detail page, keyboard navigation tab order, focus management.
  - Run with `pnpm test:e2e` (or configured script).
- [ ] **Test utilities**: Add test helpers for creating mock assignments, sub-tasks, notes with realistic data. Seed test DB for integration tests.
- [ ] **CI integration**: Ensure all test suites run in CI (GitHub Actions or configured CI). Unit tests on every PR; E2E on main branch or nightly.
- [ ] **Documentation — Architecture data model** (`docs/architecture/data-model.md`):
  - Update SubTask entity: confirm all fields (`id`, `assignment_id`, `title`, `completed`, `position`, `created_at`, `updated_at`), indexes, FK cascade.
  - Update Note entity: confirm model (1:1 or 1:N per 3.0 decision), all fields, indexes, FK cascade.
  - Add "Protected from iCal re-import" note for both entities.
  - Document `source` field semantics (`ical` vs `manual`), `ical_uid` NULL for manual.
- [ ] **Documentation — IPC contract** (`docs/architecture/ipc-contract.md`):
  - Verify all 7 sub-task/note channels documented with request/response types.
  - Verify `db:changed` event payload includes `sub_tasks` and `notes` tables.
  - Add any new channels if added during Phase 3 (e.g., `db:subtasks:reorder` if implemented).
- [ ] **Documentation — Root README**:
  - Update "Current Phase" badge to Phase 3.
  - Add Phase 3 features to feature list: Sub-tasks, Notes, Progress indicator, Detail view.
  - Update roadmap status: Phase 3 ✅ (or in progress).
- [ ] **Documentation — Keyboard shortcuts** (from 3.9):
  - Add to `docs/architecture/accessibility.md` or a new `docs/user/keyboard-shortcuts.md`.
  - List all shortcuts with descriptions.
- [ ] **TypeScript strictness**: Ensure no `any` types in new Phase 3 code. Run `pnpm typecheck` with strict mode.
- [ ] **Lint/format**: Run `pnpm lint` and `pnpm format` — no errors, all code formatted.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Test isolation**: Each test file sets up its own mock store/IPC/db. No shared mutable state between tests.
- [ ] **Mock IPC for frontend tests**: Use `vi.mock` to mock `window.api` with controlled responses. Test both success and error paths.
- [ ] **Mock `db:changed` events**: Simulate events by calling the registered callbacks in tests to verify live update logic.
- [ ] **Playwright test independence**: Each E2E test can run standalone. Use `test.beforeEach` to reset DB/state (or use a fresh test profile).
- [ ] **Test data factories**: Create factory functions for `createMockAssignment()`, `createMockSubTask()`, `createMockNote()` with sensible defaults and override options.
- [ ] **Coverage thresholds**: Aim for >80% line coverage on new Phase 3 backend code; >70% on frontend components. Configure in `vitest.config.ts`.
- [ ] **No flaky tests**: Avoid timing-dependent assertions. Use `waitFor` / `expect.poll` for async state. Mock timers where needed.
- [ ] **Documentation as code**: Architecture docs reflect the _actual_ implemented schema/IPC. If implementation deviated from design, update docs to match reality.
- [ ] **Versioned docs**: If IPC contracts changed, note version in `ipc-contract.md` (additive only per versioning strategy).

## Code Changes

> List any source code files that need changes and describe the required changes.

### Backend Tests

| File                                              | Change                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `src/backend/shared/__tests__/repository.test.ts` | Add tests for sub-task/note CRUD, cascade delete, import protection. |
| `src/backend/main/__tests__/ipc-handlers.test.ts` | Add tests for `db:subtasks:*` and `db:notes:*` channels.             |
| `src/backend/main/__tests__/import.test.ts`       | Add regression test: import preserves sub-tasks/notes.               |
| `src/backend/main/__tests__/scheduler.test.ts`    | Verify scheduler doesn't touch sub-tasks/notes (if not already).     |

### Frontend Tests

| File                                                                         | Change                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/frontend/src/components/subtasks/__tests__/SubTaskList.test.tsx`        | Component tests for list, empty, loading.                     |
| `src/frontend/src/components/subtasks/__tests__/SubTaskRow.test.tsx`         | Checkbox, delete, keyboard.                                   |
| `src/frontend/src/components/subtasks/__tests__/SubTaskAddInput.test.tsx`    | Validation, Enter/Escape, focus.                              |
| `src/frontend/src/components/subtasks/__tests__/DeleteConfirmModal.test.tsx` | Focus trap, confirm/cancel, restoration.                      |
| `src/frontend/src/components/subtasks/__tests__/AllCompletePrompt.test.tsx`  | Appear, mark complete, dismiss, reappear.                     |
| `src/frontend/src/components/ui/__tests__/ProgressBar.test.tsx`              | Sizes, labels, ARIA, reduced motion.                          |
| `src/frontend/src/components/notes/__tests__/NotesEditor.test.tsx`           | Save/cancel, keyboard, validation.                            |
| `src/frontend/src/components/notes/__tests__/NoteEntry.test.tsx`             | Display, delete.                                              |
| `src/frontend/src/pages/__tests__/AssignmentDetailPage.test.tsx`             | Full page integration, error states, deep link.               |
| `src/frontend/src/hooks/__tests__/useSubTasks.test.ts`                       | Hook logic, optimistic, rollback, live updates.               |
| `src/frontend/src/hooks/__tests__/useSubTaskProgress.test.ts`                | Calculations, reactivity.                                     |
| `src/frontend/src/hooks/__tests__/useFocusRestoration.test.ts`               | Save/restore focus.                                           |
| `src/frontend/test/subtasks.spec.ts`                                         | E2E: add, toggle, delete, persist, progress.                  |
| `src/frontend/test/notes.spec.ts`                                            | E2E: add, edit, delete, timestamps, persist.                  |
| `src/frontend/test/detail-view.spec.ts`                                      | E2E: navigation, back focus, deep link, manual assignment.    |
| `src/frontend/test/cascade-safety.spec.ts`                                   | E2E: cascade delete, re-import protection, manual assignment. |
| `src/frontend/test/accessibility.spec.ts`                                    | E2E: axe scan, keyboard nav, focus management.                |
| `src/frontend/test/test-utils.ts`                                            | **New**. Factories, mock helpers, test DB setup.              |

### Configuration

| File                                           | Change                                              |
| ---------------------------------------------- | --------------------------------------------------- |
| `config/vitest/vitest.shared.ts` (or relevant) | Add coverage thresholds, test timeout, mock setup.  |
| `playwright.config.ts`                         | Ensure E2E test config includes Phase 3 test files. |

### Documentation

| File                                 | Change                                                            |
| ------------------------------------ | ----------------------------------------------------------------- |
| `docs/architecture/data-model.md`    | Update SubTask/Note entities, protected fields, source semantics. |
| `docs/architecture/ipc-contract.md`  | Verify/update sub-task/note channels, events.                     |
| `README.md` (root)                   | Phase 3 badge, feature list, roadmap update.                      |
| `docs/architecture/accessibility.md` | Keyboard shortcuts reference (from 3.9).                          |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Backend unit tests pass**: All new repository, import, IPC handler tests pass in isolation (`pnpm test:backend` or similar).
- [ ] **Frontend component tests pass**: All new component/hook tests pass (`pnpm test:frontend`).
- [ ] **E2E tests pass**: All 5 Playwright test suites pass (`pnpm test:e2e`).
- [ ] **Coverage thresholds met**: Backend >80%, Frontend >70% on new Phase 3 code.
- [ ] **No flaky tests**: Re-run test suite 3x — all pass consistently.
- [ ] **Data model doc updated**: SubTask/Note entities match implemented schema; protected fields noted; source semantics documented.
- [ ] **IPC contract doc updated**: All 7 channels documented with correct types; events include sub_tasks/notes.
- [ ] **README updated**: Phase 3 badge, features listed, roadmap reflects Phase 3 complete.
- [ ] **Keyboard shortcuts documented**: All shortcuts listed with descriptions in architecture docs.
- [ ] **TypeScript strict**: `pnpm typecheck` passes with no `any` in new Phase 3 code.
- [ ] **Lint/format clean**: `pnpm lint` and `pnpm format` pass with no errors.
- [ ] **CI pipeline green**: All test jobs pass in CI (verify on a test PR).

## Notes

> Any additional context, risks, or considerations.

- **Test execution limits**: Per project guidelines (`.github/copilot-instructions.md`), run tests with limited concurrency:
  - Unit: `npx vitest run --pool=forks --poolOptions.forks.singleFork`
  - E2E: Playwright runs sequentially by default; configure `workers: 1` if needed.
  - Always cleanup after tests: `pkill -f "vitest" || true`
- **Test database**: Use an in-memory SQLite or a temporary file DB for unit/integration tests. Reset between test files.
- **Mocking `window.api`**: Create a shared test utility `mockWindowApi()` that returns a fully typed mock with controllable responses for each channel.
- **E2E test setup**: Playwright tests should launch the built app (`pnpm build` + `pnpm preview`) or run against dev server. Configure `baseURL` accordingly.
- **Documentation sync**: This ticket is the "source of truth" sync — if any Phase 3 implementation deviated from the original tickets, update docs to match what was actually built.
- **Future test maintenance**: Add a `TESTING.md` or section in README with commands to run each test suite locally.
- **Regression prevention**: The cascade-safety and re-import protection tests are critical — they prevent data loss bugs. Keep them as permanent regression tests.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Add unit/component/E2E tests for sub-tasks, notes, progress, detail view; update data model, IPC contract, README, keyboard shortcuts docs.
