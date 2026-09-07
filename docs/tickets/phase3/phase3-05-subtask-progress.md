---
applyTo: 'docs/tickets/phase3/phase3-05-subtask-progress.md'
issue: 'N/A'
---

# phase3-05-subtask-progress — Progress Indicator

## Description

Add a visual progress indicator for sub-tasks in two places: (1) the assignment row in the main list (compact), and (2) the assignment detail view header (prominent). The indicator shows `x/y complete` and a progress bar. When all sub-tasks are completed, show a gentle inline prompt: "All sub-tasks done — mark assignment complete?" with a button to complete the assignment. The prompt is dismissible and does not auto-complete the assignment.

**Prerequisite**: Tickets 3.0 (audit), 3.3 (sub-task list), and 3.4 (toggle) must be complete. Sub-task data with `completed` state is available via the store and `db:changed` events.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Progress calculation**: For a given assignment, compute `completedCount` (sub-tasks where `completed === true`) and `totalCount` (all sub-tasks). Derive `percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0`.
- [ ] **Compact progress (assignment row in list)**: In `AssignmentRow` (or `AssignmentList` item), show a small progress indicator when `totalCount > 0`:
  - Format: `3/5` (completed/total) with a thin horizontal progress bar (4px height) beneath or beside it.
  - Colors: Use the course color for the progress fill; neutral track.
  - Tooltip on hover: "3 of 5 sub-tasks complete".
  - If `totalCount === 0`, show nothing (no clutter).
- [ ] **Prominent progress (detail view header)**: In `AssignmentDetailPage` header (near title/course/due date), show a larger progress indicator when `totalCount > 0`:
  - Format: "3 of 5 sub-tasks complete (60%)" with a thicker progress bar (8px height).
  - Clicking the progress area scrolls to the sub-task list section.
- [ ] **All-complete prompt**: When `completedCount === totalCount` AND `totalCount > 0` AND the assignment status is `pending`:
  - Show an inline banner/prompt in the detail view (below the progress bar, above sub-task list): "All sub-tasks done — mark assignment complete?" with a "Mark Complete" button (primary style) and a "Dismiss" link.
  - Clicking "Mark Complete" calls `db:assignments:upsert` with `{ id, status: 'completed' }` (optimistic, like Ticket 1.11).
  - Clicking "Dismiss" hides the prompt for this assignment until the sub-task state changes (e.g., a sub-task is un-checked or a new one added). Store dismissed state in `localStorage` keyed by assignment ID.
  - The prompt does **not** appear in the compact list row — only in the detail view.
- [ ] **Live updates**: Progress indicators and the all-complete prompt update automatically via `db:changed` subscription when sub-tasks are toggled/added/deleted in any window.
- [ ] **Empty state**: If `totalCount === 0`, show no progress indicator and no prompt.
- [ ] **Keyboard accessible**: The "Mark Complete" button and "Dismiss" link are focusable and activatable via Enter/Space.
- [ ] **Screen reader**: Progress bar has `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Sub-task progress: 3 of 5 complete, 60 percent"`. The prompt is announced as a status update (ARIA live region).

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Shared progress logic**: Create a reusable `useSubTaskProgress(assignmentId)` hook (or selector in the Zustand store) that returns `{ completedCount, totalCount, percentage, isAllComplete }`. Use this in both the list row and detail header to avoid duplication.
- [ ] **Zustand integration**: The sub-task store (from 3.3) already has the sub-task list per assignment. Add a derived selector or computed value for progress. The assignment list store (from Phase 1/2) can subscribe to sub-task changes via `db:changed` to update the compact indicator.
- [ ] **Progress bar component**: Create a reusable `ProgressBar` component in `src/frontend/src/components/ui/ProgressBar.tsx` with props: `value` (0-100), `label` (optional, e.g., "3/5"), `size: 'sm' | 'md' | 'lg'`, `color` (course color), `showPercentage` (boolean). Used by both list and detail.
- [ ] **Course color for progress**: The progress bar fill uses the assignment's `course_color` (from the Assignment type). If no course color, fall back to a default accent color.
- [ ] **Prompt dismissal persistence**: Store dismissed prompt state in `localStorage` as `dismissedAllCompletePrompt:{assignmentId}:true`. Clear when sub-task count changes (add/delete) or any sub-task is toggled to incomplete.
- [ ] **No auto-complete**: The assignment is **never** auto-completed when all sub-tasks are done. The user must explicitly click "Mark Complete". This avoids surprising behavior (e.g., user checks all sub-tasks but isn't ready to mark the whole assignment done).
- [ ] **Assignment status sync**: If the user manually marks the assignment complete (via the existing list checkbox or the prompt button), the sub-tasks remain as-is (completed). If the user later un-checks a sub-task, the assignment status stays `completed` (user controls assignment status independently).
- [ ] **Animation**: Progress bar fill animates on value change (CSS transition `width 0.3s ease`). Respect `prefers-reduced-motion`.
- [ ] **Responsive**: Compact indicator hides label on very narrow widths (shows only bar + tooltip). Detail header shows full label.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/hooks/useSubTaskProgress.ts` | **New**. Hook returning `{ completedCount, totalCount, percentage, isAllComplete }` for a given `assignmentId`. Subscribes to sub-task store + `db:changed` for live updates. |
| `src/frontend/src/components/ui/ProgressBar.tsx` | **New**. Reusable progress bar: `value`, `label`, `size`, `color`, `showPercentage`, `ariaLabel`. Animated fill, reduced-motion support. |
| `src/frontend/src/components/assignments/AssignmentRow.tsx` | Update: import `ProgressBar` and `useSubTaskProgress`. Show compact progress when `totalCount > 0`. Use `size="sm"`, `showPercentage={false}`. |
| `src/frontend/src/pages/AssignmentDetailPage.tsx` | Update: import `ProgressBar`, `useSubTaskProgress`, and `AllCompletePrompt` (new). Show prominent progress in header (`size="md"`, `showPercentage={true}`). Render `AllCompletePrompt` when `isAllComplete && assignment.status === 'pending' && !dismissed`. |
| `src/frontend/src/components/subtasks/AllCompletePrompt.tsx` | **New**. Banner component: message, "Mark Complete" button (calls `db:assignments:upsert`), "Dismiss" link (sets `localStorage` flag). Props: `assignmentId`, `onMarkComplete`, `dismissed`, `onDismiss`. ARIA live region. |
| `src/frontend/src/stores/assignmentStore.ts` | Update: ensure assignment list subscribes to `db:changed` for `sub_tasks` to refresh compact progress indicators. Or use `useSubTaskProgress` in each row (preferred for simplicity). |
| `src/frontend/src/utils/localStorage.ts` | Helper functions for prompt dismissal: `isPromptDismissed(assignmentId)`, `setPromptDismissed(assignmentId, dismissed)`, `clearPromptDismissed(assignmentId)`. |

### Backend — No Changes Expected

> Uses existing `db:assignments:upsert` for "Mark Complete" and existing sub-task IPC. No new backend work.

| File | Change |
|------|--------|
| *(none expected)* | Verify `db:assignments:upsert` accepts `{ id, status: 'completed' }` and emits `db:changed`. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Compact progress shows**: Assignment rows with sub-tasks display `x/y` + thin bar in the list. Rows without sub-tasks show nothing.
- [ ] **Detail progress shows**: Detail header shows "x of y sub-tasks complete (z%)" + thicker bar when sub-tasks exist.
- [ ] **Progress calculates correctly**: `completedCount`, `totalCount`, `percentage` match the actual sub-task data.
- [ ] **Live updates**: Toggling a sub-task in the detail view updates both the detail progress and the list row progress instantly (via `db:changed`).
- [ ] **All-complete prompt appears**: When all sub-tasks are done and assignment is pending, the prompt banner shows in the detail view.
- [ ] **Mark Complete works**: Clicking "Mark Complete" updates assignment status to `completed` optimistically, persists, and the prompt disappears.
- [ ] **Dismiss works**: Clicking "Dismiss" hides the prompt. Reloading the page keeps it hidden until sub-task state changes.
- [ ] **Prompt reappears on change**: After dismiss, adding a new sub-task or un-checking one makes the prompt appear again (if all become complete again).
- [ ] **No auto-complete**: Verified that completing all sub-tasks does NOT change assignment status without user action.
- [ ] **Click progress scrolls**: Clicking the progress bar in the detail header scrolls smoothly to the sub-task list section.
- [ ] **Keyboard**: Tab to "Mark Complete" button → Enter activates; Tab to "Dismiss" → Enter activates.
- [ ] **Screen reader**: Progress bar has correct ARIA attributes; prompt announced via live region.
- [ ] **Reduced motion**: Progress bar animation disabled when `prefers-reduced-motion: reduce`.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on 3.3/3.4**: Needs sub-task store with live data and toggle working. The progress hook reads from the same store.
- **Assignment list integration**: The compact progress in `AssignmentRow` can call `useSubTaskProgress(assignment.id)` directly — each row subscribes to its own assignment's sub-tasks. This is simple and performs fine at MVP scale (<500 assignments). If performance becomes an issue, move to a shared selector in the assignment store.
- **Dismiss persistence**: Use `localStorage` with a key like `courseflow:dismissedPrompt:${assignmentId}`. Clear the key when `totalCount` changes or any sub-task becomes incomplete.
- **Course color**: The `Assignment` type includes `course_color`. Pass it to `ProgressBar` for the fill color.
- **Testing**:
  - Unit: `useSubTaskProgress` hook (mock store data), `ProgressBar` component (value, label, size, color, ARIA).
  - Component: `AllCompletePrompt` (render, mark complete, dismiss, reappear on change).
  - E2E: Playwright test in `src/frontend/test/subtasks.spec.ts` (extend) — progress in list, progress in detail, all-complete prompt flow, dismiss persistence, live updates, keyboard, accessibility.
- **Future**: Could add a "progress ring" variant for circular display, or show progress in grouped views (Phase 2).

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Add sub-task progress indicator (x/y + bar) to assignment list rows and detail header; all-complete prompt with manual mark-complete.