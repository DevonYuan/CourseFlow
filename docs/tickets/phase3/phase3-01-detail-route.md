---
applyTo: 'docs/tickets/phase3/phase3-01-detail-route.md'
issue: 'N/A'
---

# phase3-01-detail-route — Detail View Route & Navigation

## Description

Add a dedicated detail view for each assignment at `/assignments/:id`. This is the entry point for Phase 3's productivity features (sub-tasks, notes) and turns the assignment list into a navigable interface. Users should be able to click (or keyboard-activate) any assignment row to open the detail view, which displays the assignment's full information: title, course badge, due date with overdue/all-day handling, Canvas description, and status.

This ticket establishes the **route**, **navigation**, and **page shell** — data loading and sub-task/note UI are handled in follow-up tickets.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Route definition**: Add `/assignments/:id` route using React Router (or existing routing setup) that accepts an assignment UUID parameter.
- [ ] **Clickable assignment rows**: Make each row in `AssignmentList` an interactive element (button or link) that navigates to the detail route. Must be keyboard-accessible (Enter/Space to activate, focus visible).
- [ ] **Detail page shell**: Create `AssignmentDetailPage` component that renders at the route. Includes a header area (back navigation, title, course badge, due date, status) and a content area for the description (placeholder for sub-tasks/notes to be added in later tickets).
- [ ] **Back navigation**: Provide a clear way to return to the list (browser back button works, plus a visible "Back" button in the header).
- [ ] **Loading state**: Show a skeleton/loader while the assignment is being fetched (via `db:assignments:get`).
- [ ] **Error state**: Handle "not found" (invalid ID, deleted assignment) with a friendly message and a link back to the list.
- [ ] **Deep-linkable**: The URL must be shareable/bookmarkable — navigating directly to `/assignments/:id` loads the correct assignment.
- [ ] **URL sync with list filters**: The list page should retain its filter/sort/group state when the user navigates away to a detail and back (use `localStorage` or URL search params for list state persistence).

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Route vs. modal**: Use a **route** (`/assignments/:id`), not a modal. This enables deep linking, browser history, and avoids focus-trap complexity. The existing router (React Router or equivalent) is already set up in Phase 1.
- [ ] **Assignment row click target**: The entire row should be clickable, but **do not** wrap the row in an `<a>` if it contains other interactive elements (checkbox, drag handle). Use a button with `onClick` navigation, or make only the title cell a link. Ensure drag-and-drop (Phase 2) still works — the drag handle must not trigger navigation.
- [ ] **Due date display**: Follow the same formatting as the list (local timezone, relative labels like "Today", "Tomorrow", "Overdue"). All-day events (from iCal `VALUE=DATE`) show without a time and are treated as due at 12:00 UTC for grouping purposes.
- [ ] **Description rendering**: Canvas descriptions come as HTML. Sanitize before rendering (e.g., DOMPurify) to prevent XSS. Render in a contained element with controlled styles.
- [ ] **Status badge**: Reuse the existing status badge component from the list (Pending/Completed).
- [ ] **Course color badge**: Show the course color dot/badge next to the course name in the header, consistent with the list.
- [ ] **Focus management**: On route entry, focus the first focusable element in the detail view (e.g., the back button or the title). On return to list, restore focus to the row that was clicked.
- [ ] **Responsive**: Minimum width 800px (per Phase 1). Detail view should work at that width and scale up.
- [ ] **No sub-task/note UI yet**: This ticket stops at the assignment header + description. Sub-tasks (3.3) and notes (3.6) are separate tickets.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File                                                                          | Change                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/routes.tsx` (or routing config)                             | Add `/assignments/:id` route pointing to `AssignmentDetailPage`.                                                                                                                                                            |
| `src/frontend/src/pages/AssignmentDetailPage.tsx`                             | **New file**. Page component: fetches assignment via `window.api.db.assignments.get(id)`, renders header + description + placeholder sections. Handles loading/error/not-found states.                                      |
| `src/frontend/src/components/AssignmentRow.tsx` (or wherever the row renders) | Make row (or title cell) interactive: add `onClick` → `navigate(/assignments/${assignment.id})`. Ensure keyboard activation (Enter/Space). Add `tabIndex=0` and `role="button"` if using a `div`, or use native `<button>`. |
| `src/frontend/src/components/AssignmentList.tsx`                              | Ensure list state (filters, sort, grouping) persists across navigation (already in `localStorage` per Phase 2 ticket 2.12; verify).                                                                                         |
| `src/frontend/src/hooks/useAssignmentDetail.ts` (optional)                    | Custom hook to encapsulate `db:assignments:get` + `db:changed` subscription for live updates. Can be created here or in Ticket 3.2.                                                                                         |
| `src/frontend/src/utils/date.ts`                                              | Reuse/extend date formatting helpers for due date display (overdue, today, tomorrow, all-day).                                                                                                                              |
| `src/frontend/src/utils/sanitize.ts` (new or existing)                        | Add HTML sanitization utility (DOMPurify) for rendering Canvas description safely.                                                                                                                                          |

### Shared / Types (if needed)

| File                          | Change                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/shared/types.ts` | Verify `Assignment` type includes all fields needed for detail view (`description`, `html_url`, `workflow_state`, `points_possible`, `submission_types`, `unlock_at`, `lock_at`). No new types needed for this ticket. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Route works**: Navigating to `/assignments/:valid-uuid` renders the detail page with the correct assignment's data.
- [ ] **Click navigation**: Clicking an assignment row in the list navigates to its detail view. URL updates in browser address bar.
- [ ] **Keyboard navigation**: Tabbing to a row and pressing Enter/Space opens the detail view. Focus is visible on rows.
- [ ] **Deep link**: Copying the detail URL, opening in a new tab, loads the correct assignment.
- [ ] **Back navigation**: Clicking the browser back button (or a "Back" button in the header) returns to the list at the same scroll position with filters/sort/group preserved.
- [ ] **Loading state**: A skeleton/loading indicator shows while the assignment is being fetched.
- [ ] **Error state**: Navigating to `/assignments/invalid-uuid` or a deleted assignment shows a "Not found" message with a link back to the list.
- [ ] **Header displays**: Title, course badge (with color), due date (formatted, overdue handling), status badge, and sanitized description all render correctly.
- [ ] **Description sanitized**: HTML from Canvas description renders safely (no script execution, styles contained).
- [ ] **All-day events**: Assignments with all-day due dates show without a time component and with an "All day" label.
- [ ] **Drag-drop unaffected**: Dragging a row via the drag handle (Phase 2) does NOT trigger navigation to detail.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes with no errors.
- [ ] **Lint passes**: `pnpm lint` passes with no errors.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on Ticket 3.0**: This ticket assumes the `Assignment` type and `db:assignments:get` IPC are already aligned and working. The audit in 3.0 should confirm the `description` field and any other fields needed for the detail view are present.
- **Existing router**: Phase 1 ticket 1.18 (`phase1-18-app-composition`) set up routing with `App.tsx` composing pages. Reuse that setup — do not introduce a new router.
- **Zustand store**: The list page likely uses a Zustand store for assignments. The detail page can either fetch independently via IPC or read from the store if the assignment is already loaded. Simpler approach: independent fetch via `window.api.db.assignments.get(id)` to support deep linking without list hydration.
- **Live updates**: Subscribe to `window.api.onDbChanged` for `assignments` table changes so the detail view updates if the assignment is modified elsewhere (e.g., marked complete from the list). This can be minimal in this ticket and expanded in 3.2.
- **Playwright test locations**: New e2e tests should go in `src/frontend/test/` (or existing e2e folder). Suggested test file: `assignment-detail.spec.ts`.
- **Sanitization dependency**: If DOMPurify is not yet in `package.json`, add it (`pnpm add dompurify @types/dompurify`). It's a small, well-maintained library.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Add assignment detail view at `/assignments/:id` with title, course, due date, status, and description — clickable rows, deep-linkable, keyboard accessible.
