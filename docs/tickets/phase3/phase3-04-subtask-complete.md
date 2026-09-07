---
applyTo: 'docs/tickets/phase3/phase3-04-subtask-complete.md'
issue: 'N/A'
---

# phase3-04-subtask-complete — Complete / Toggle Sub-task

## Description

Implement the toggle completion interaction for sub-tasks. Each sub-task row has a checkbox that, when clicked, immediately toggles the `completed` state via the `db:subtasks:toggle` IPC channel. The UI updates optimistically with instant feedback, and the change persists across reloads. This builds on the sub-task list from Ticket 3.3 and enables the progress indicator in Ticket 3.5.

**Prerequisite**: Ticket 3.0 (audit) and Ticket 3.3 (sub-task list core) must be complete. The `db:subtasks:toggle` IPC channel, `SubTask` type with `completed` field, and `window.api.db.subtasks.toggle` preload bridge must be verified and working.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Checkbox interaction**: The checkbox in `SubTaskRow` (created in 3.3) becomes interactive. Clicking it toggles the sub-task's `completed` state.
- [ ] **Optimistic toggle**: On click, immediately flip the `completed` boolean in the local Zustand store and re-render. Then call `window.api.db.subtasks.toggle({ id, completed: newValue })`.
- [ ] **IPC call**: Use `db:subtasks:toggle` channel with payload `{ id: string; completed: boolean }`. Expect `IpcResult<SubTask>` response with the updated sub-task.
- [ ] **Rollback on failure**: If the IPC returns `ok: false`, revert the optimistic update in the store and show an error toast: "Failed to update sub-task".
- [ ] **Keyboard activation**: Checkbox is focusable and toggles on **Space** or **Enter** (standard checkbox behavior). Ensure `role="checkbox"`, `aria-checked`, `tabIndex=0` if using a custom element, or use native `<input type="checkbox">`.
- [ ] **Visual feedback**: 
  - Completed sub-tasks show strikethrough text (or reduced opacity) and a checked checkbox.
  - Pending sub-tasks show normal text and unchecked checkbox.
  - Transition/animation for the toggle (optional but nice).
- [ ] **Loading state during toggle**: Briefly show a spinner or disable the checkbox while the IPC is in-flight (optional — the optimistic update makes this feel instant; a subtle "saving" indicator is sufficient).
- [ ] **Live updates**: Subscribe to `db:changed` for `sub_tasks` table. If another window/process toggles a sub-task, the checkbox state updates automatically.
- [ ] **Persisted across reloads**: The `completed` state is stored in SQLite; reloading the detail page shows the correct checkbox state.
- [ ] **Toast on error only**: No success toast needed (the instant checkbox flip is confirmation enough). Only show toast on failure with "Retry" action that re-sends the toggle.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Native checkbox preferred**: Use `<input type="checkbox">` for native keyboard/accessibility behavior. Style with CSS to match the app's design (accent color, size). Avoid custom `div` checkboxes unless absolutely necessary.
- [ ] **Zustand action**: Add `toggleSubTask(id, completed)` to the sub-task store (created in 3.3). It performs the optimistic flip, calls the IPC hook, handles rollback.
- [ ] **IPC hook**: Extend `useSubTasks.ts` (from 3.3) with `toggleSubTask(id, completed)` that wraps the IPC call and returns the updated `SubTask` or throws on error.
- [ ] **Idempotency**: The backend `toggle` handler should be idempotent — toggling to the same value returns the current state without error.
- [ ] **No "mark all complete" yet**: Batch operations are out of scope for Phase 3. Individual toggle only.
- [ ] **Sub-task completion ≠ assignment completion**: Completing all sub-tasks does **not** auto-complete the parent assignment. Ticket 3.5 will add a gentle prompt ("All sub-tasks done — mark assignment complete?") but the decision stays with the user.
- [ ] **Animation**: A subtle CSS transition on the checkbox and text opacity (e.g., 150ms ease) makes the toggle feel polished.
- [ ] **Reduced motion**: Respect `prefers-reduced-motion` — disable transitions if the user has reduced motion enabled.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/components/subtasks/SubTaskRow.tsx` | Update: make checkbox interactive. Use native `<input type="checkbox" checked={completed} onChange={handleToggle} />`. Add `handleToggle` prop that calls the store's `toggleSubTask`. Apply strikethrough/opacity style when `completed`. |
| `src/frontend/src/stores/subtaskStore.ts` | Add `toggleSubTask(id, completed)` action: optimistic flip → call `useSubTasks.toggleSubTask()` → on error, rollback + toast. |
| `src/frontend/src/hooks/useSubTasks.ts` | Add `toggleSubTask(id, completed)` function: calls `window.api.db.subtasks.toggle({ id, completed })`, unwraps `IpcResult`, returns updated `SubTask` or throws. |
| `src/frontend/src/components/subtasks/SubTaskList.tsx` | Pass `onToggle` handler down to `SubTaskRow` (or connect rows directly to store). |
| `src/frontend/src/utils/toast.ts` | Use existing toast utility for error toast with "Retry" action. |

### Backend — No Changes Expected

> Assumes Ticket 3.0 audit confirmed the backend has `db:subtasks:toggle` handler, repository `toggleSubTask(id, completed)`, and `db:changed` event emission for `sub_tasks` updates.

| File | Change |
|------|--------|
| *(none expected)* | Verify in 3.0 that `ipc-handlers.ts` has `db:subtasks:toggle` handler calling repo, returning `IpcResult<SubTask>`, emitting `db:changed`. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Checkbox toggles**: Clicking the checkbox flips `completed` state immediately (optimistic).
- [ ] **IPC called**: `db:subtasks:toggle` is invoked with correct `{ id, completed }` payload.
- [ ] **State persists**: Reloading the page shows the sub-task with the toggled `completed` state.
- [ ] **Rollback works**: Simulate IPC failure (e.g., network disconnect) → checkbox reverts to previous state, error toast appears with "Retry".
- [ ] **Retry works**: Clicking "Retry" on the toast re-sends the toggle and succeeds.
- [ ] **Keyboard**: Tab to checkbox → Space/Enter toggles it. Focus outline visible.
- [ ] **Screen reader**: Checkbox has `role="checkbox"` (native), `aria-checked` reflects state, `aria-label` or associated label describes the sub-task.
- [ ] **Visual states**: Completed → strikethrough + checked; Pending → normal + unchecked.
- [ ] **Live updates**: Toggling a sub-task in another window updates the checkbox here via `db:changed` without refresh.
- [ ] **No assignment auto-complete**: Completing all sub-tasks does not change the parent assignment's status (verified by checking assignment status badge).
- [ ] **Reduced motion**: Transitions disabled when `prefers-reduced-motion: reduce` is set.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on Ticket 3.3**: This ticket modifies `SubTaskRow` and the store/hook created in 3.3. Develop sequentially or coordinate closely.
- **Backend toggle handler**: The `db:subtasks:toggle` IPC in `ipc-handlers.ts` should:
  1. Validate `id` exists and `completed` is boolean
  2. Call `repository.toggleSubTask(id, completed)` (UPDATE ... SET completed = ?, updated_at = datetime('now'))
  3. Return `IpcResult<SubTask>` with updated row
  4. Emit `db:changed` with `{ table: 'sub_tasks', action: 'update', id }`
- **Optimistic pattern**: Follow the same pattern as `addSubTask`/`deleteSubTask` in 3.3 — flip local state first, then IPC, then rollback on error. Reuse the `optimisticUpdate` / `rollback` helpers in the store.
- **Testing**:
  - Unit: `toggleSubTask` store action (mock IPC success/failure), `useSubTasks.toggleSubTask` hook.
  - Component: `SubTaskRow` checkbox interaction, visual states, keyboard.
  - E2E: Playwright test in `src/frontend/test/subtasks.spec.ts` (extend from 3.3) — toggle, reload persists, failure rollback, live update, keyboard, accessibility.
- **Future**: If "mark all complete" is added later, it would batch multiple `toggle` calls or add a new `db:subtasks:toggleMany` channel.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Add sub-task completion toggle: click checkbox to mark done/undone, optimistic UI, persists, keyboard accessible, live updates.