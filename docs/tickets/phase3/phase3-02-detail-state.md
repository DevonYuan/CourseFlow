---
applyTo: 'docs/tickets/phase3/phase3-02-detail-state.md'
issue: 'N/A'
---

# phase3-02-detail-state — Detail Data Loading & Store

## Description

Implement the data loading layer for the assignment detail view. This ticket creates the hook/store that fetches a single assignment via `db:assignments:get`, loads its sub-tasks and notes, and subscribes to `db:changed` events for live updates. It provides loading, error, and not-found states to the UI. This is the data foundation for the detail page (Ticket 3.1) and all sub-task/notes features (Tickets 3.3–3.7).

**Prerequisite**: Ticket 3.0 (audit) must be complete — `db:assignments:get`, `db:subtasks:list`, `db:notes:list` IPC channels and `window.api` preload bridge must be verified and working.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Fetch assignment by ID**: Call `window.api.db.assignments.get(id)` on mount. Handle `IpcResult<Assignment | null>` response.
- [ ] **Fetch sub-tasks**: Call `window.api.db.subtasks.list(assignmentId)` after assignment loads (or in parallel). Handle `IpcResult<SubTask[]>`.
- [ ] **Fetch notes**: Call `window.api.db.notes.list(assignmentId)` (or `get` if 1:1 per 3.0 decision). Handle `IpcResult<Note[]>` or `IpcResult<Note | null>`.
- [ ] **Loading state**: Expose `isLoading` (true while any fetch is pending). Show skeleton in UI (Ticket 3.1).
- [ ] **Error state**: Expose `error` if any fetch returns `ok: false`. Show error message with "Retry" button in UI.
- [ ] **Not-found state**: If assignment returns `null` (or 404), expose `notFound: true`. UI shows "Assignment not found" with link back to list.
- [ ] **Live updates — Assignment**: Subscribe to `window.api.onDbChanged` for `table === 'assignments'` and matching `id`. Refetch or merge updated assignment data.
- [ ] **Live updates — Sub-tasks**: Subscribe to `onDbChanged` for `table === 'sub_tasks'` with matching `assignmentId` (or all, then filter). Update sub-task list in real-time.
- [ ] **Live updates — Notes**: Subscribe to `onDbChanged` for `table === 'notes'` with matching `assignmentId`. Update notes in real-time.
- [ ] **Cleanup**: Unsubscribe from `onDbChanged` on unmount. Cancel in-flight requests if component unmounts before resolution.
- [ ] **Retry mechanism**: Expose `refetch()` function to retry all fetches (used by error state "Retry" button).
- [ ] **Optimistic updates integration**: When sub-task/note mutations happen via other tickets (3.3–3.7), the store should optimistically update and the `db:changed` subscription will confirm/rollback. This hook provides the base state that other hooks (useSubTasks, useNotes) build upon.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Single source of truth**: Create a Zustand store `useAssignmentDetailStore` (or extend existing) keyed by `assignmentId`. Multiple components (header, sub-tasks, notes, progress) read from this store.
- [ ] **Parallel fetches**: Fire `assignments.get`, `subtasks.list`, `notes.list` in parallel for faster load. Use `Promise.allSettled` to handle partial failures.
- [ ] **Event filtering**: `db:changed` events include `{ table, action, id }`. For sub-tasks/notes, the `id` is the sub-task/note ID, not the assignment ID. The store must filter events by checking if the changed entity belongs to the current `assignmentId` (requires a way to map sub-task/note ID → assignment ID, or refetch list on any sub-task/note change for this assignment).
- [ ] **Refetch vs. merge**: For simplicity, on any relevant `db:changed` event, refetch the affected list (sub-tasks or notes). Assignment updates can be merged directly (single object).
- [ ] **Debounce rapid events**: If many `db:changed` events fire quickly (e.g., bulk import), debounce refetches (e.g., 300ms) to avoid hammering IPC.
- [ ] **No stale data**: On `assignmentId` change (user navigates to different assignment), immediately show loading state, cancel previous requests, fetch new data.
- [ ] **Shared across tabs**: If user opens multiple detail tabs (unlikely in Electron single-window, but possible), each has its own store instance keyed by assignmentId.
- [ ] **TypeScript types**: Return type includes `{ assignment, subTasks, notes, isLoading, error, notFound, refetch }`. All fully typed, no `any`.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/stores/assignmentDetailStore.ts` | **New**. Zustand store: `assignment`, `subTasks`, `notes`, `isLoading`, `error`, `notFound`, `fetch(assignmentId)`, `refetch()`, `subscribeToChanges(assignmentId)`, `unsubscribe()`. Internal: `abortController` for cancellation, `eventUnsubscribe` cleanup. |
| `src/frontend/src/hooks/useAssignmentDetail.ts` | **New**. Hook: `const { assignment, subTasks, notes, isLoading, error, notFound, refetch } = useAssignmentDetail(assignmentId)`. Calls store `fetch` on `assignmentId` change, returns store state. Handles cleanup on unmount. |
| `src/frontend/src/pages/AssignmentDetailPage.tsx` | Update: use `useAssignmentDetail(assignmentId)` from route params. Render loading/error/not-found states. Pass data to child components (header, sub-tasks, notes, progress). |
| `src/frontend/src/components/assignments/AssignmentHeader.tsx` | **New or update**. Receives `assignment` prop, renders title, course badge, due date, status, description. Used by detail page. |
| `src/frontend/src/utils/date.ts` | Ensure date formatting helpers available for due date display (overdue, today, tomorrow, all-day). |

### Backend — No Changes Expected

> Assumes Ticket 3.0 audit confirmed all IPC channels exist and work.

| File | Change |
|------|--------|
| *(none expected)* | Verify `db:assignments:get`, `db:subtasks:list`, `db:notes:list` return correct types. Verify `onDbChanged` emits for all three tables. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Assignment loads**: Navigating to `/assignments/:valid-id` fetches and displays assignment data.
- [ ] **Sub-tasks load**: Sub-task list appears with correct data for the assignment.
- [ ] **Notes load**: Notes appear with correct data for the assignment.
- [ ] **Loading state**: Skeleton shows while any fetch is pending; disappears when all complete.
- [ ] **Error state**: Simulate IPC failure → error message + "Retry" button shown; clicking Retry refetches.
- [ ] **Not-found state**: Navigate to `/assignments/invalid-uuid` → "Assignment not found" + link to list.
- [ ] **Live update — Assignment**: Change assignment title via another window (or direct DB) → detail view updates within 500ms.
- [ ] **Live update — Sub-tasks**: Add/toggle/delete sub-task in another window → sub-task list updates without refresh.
- [ ] **Live update — Notes**: Add/edit/delete note in another window → notes update without refresh.
- [ ] **Cleanup on unmount**: Navigate away from detail page → no memory leaks, no stray event listeners, no state bleed to next assignment.
- [ ] **No stale data on navigation**: Click assignment A → click Back → click assignment B → B's data loads correctly, no A data shown.
- [ ] **Debounced events**: Rapid `db:changed` events (simulated) → single refetch after debounce.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on 3.0**: Cannot start until IPC channels are verified. If 3.0 adds missing fields to `Assignment`/`SubTask`/`Note` types, update this hook's types accordingly.
- **Dependency on 3.1**: Ticket 3.1 creates the route and page shell. This ticket provides the data hook. They can be developed in parallel with a mock hook.
- **Store keying**: Use a map `assignmentId -> AssignmentDetailState` in Zustand so multiple assignments can be cached (e.g., for quick back-navigation). But for MVP, a single `currentAssignmentId` + state is simpler.
- **Event mapping for sub-tasks/notes**: `db:changed` for sub-tasks gives `{ table: 'sub_tasks', action, id: subTaskId }`. To know if it affects our assignment, we'd need to either:
  1. Refetch sub-tasks on ANY sub-task change (simple, slightly chatty).
  2. Maintain a local `subTaskId -> assignmentId` map in the store (more precise).
  3. Include `assignmentId` in the `db:changed` payload for sub-tasks/notes (backend change, cleaner).
  
  **Recommendation**: Option 3 — update `ipc-handlers.ts` to emit `{ table, action, id, assignmentId? }` for sub-tasks/notes. If backend change not feasible in 3.0, use Option 1 (refetch on any sub-task change) for now.

- **AbortController**: Use `AbortController` for fetch cancellation. The IPC layer (`window.api`) may not support abort natively; implement a wrapper that ignores responses if aborted.
- **Testing**:
  - Unit: `useAssignmentDetail` hook (mock store/IPC), `assignmentDetailStore` actions.
  - Component: `AssignmentDetailPage` with mocked hook (loading, error, not-found, success).
  - Integration: Playwright test in `detail-view.spec.ts` (with 3.1) — load, live updates, error, not-found, navigation.
- **Future**: Add caching (stale-while-revalidate) for instant back-navigation. Add `lastFetched` timestamp for cache invalidation.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Add data loading hook for assignment detail: fetches assignment, sub-tasks, notes; live updates via db:changed; loading/error/not-found states.