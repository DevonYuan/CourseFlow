# Ticket: phase1-09-assignment-list

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 1 day

---

## Description

Build `AssignmentList` component: fetch via `window.api.db.assignments.list()`, render chronologically (by `dueDate`), show course color badge, title, due date, status badge.

---

## Requirements

### Functional

- [ ] **Component**: `AssignmentList` — main view component
- [ ] **Data Fetching**: Call `window.api.db.assignments.list()` on mount and on `db:changed` events
- [ ] **Sorting**: Chronological by `dueAt` (ascending — soonest first)
- [ ] **Row Rendering** per assignment:
  - Course color badge (colored circle/square using `courseColor`)
  - Assignment title (truncate with ellipsis if too long)
  - Due date formatted: "Mon, Jan 15 • 11:59 PM" (local timezone)
  - Status badge: "Pending" (default), "Completed" (green), "Archived" (gray)
  - Checkbox/button to mark complete (ticket 1.11)
- [ ] **Course Grouping** (optional but recommended): Group by `courseName` with course header
- [ ] **Responsive**: Works at min-width 800px, stacks on narrow

### Non-Functional

- [ ] **State Management**: Zustand store for assignments (synced via IPC)
- [ ] **Performance**: Virtualized list if >100 assignments (react-window or simple windowing)
- [ ] **Accessibility**: Semantic HTML (`<table>` or `<dl>`), proper labels, keyboard navigation
- [ ] **TypeScript**: Typed `Assignment` from `window.api` types

---

## Designs & Constraints

- **Location**: `src/frontend/src/components/AssignmentList.tsx`
- **IPC Channels** (from contract):
  - `db:assignments:list` — fetch all assignments
  - `db:assignments:upsert` — mark complete (ticket 1.11)
  - `db:changed` event — subscribe for auto-refresh
- **Preload API** (to be exposed in `src/backend/preload/index.ts`):
  ```typescript
  db: {
    assignments: {
      list: () => Promise<Assignment[]>;
      upsert: (input: AssignmentInput) => Promise<Assignment>;
    };
    onDbChanged: (callback: (payload: DbChangedEvent) => void) => () => void;
  }
  ```

### `Assignment` Type (from shared types)

```typescript
interface Assignment {
  id: string;
  canvasId?: string;
  title: string;
  description?: string;
  courseName: string;
  courseColor: string;
  dueAt: number; // Unix ms
  unlockAt?: number;
  lockAt?: number;
  pointsPossible?: number;
  submissionTypes?: string;
  workflowState?: string;
  htmlUrl?: string;
  icalUid: string;
  source: 'ical' | 'manual';
  sourceUrl?: string;
  status: 'pending' | 'completed' | 'archived';
  priority: number;
  rrule?: string;
  createdAt: number;
  updatedAt: number;
}
```

---

## Code Changes

### New Files

- `src/frontend/src/components/AssignmentList.tsx` — main component
- `src/frontend/src/components/AssignmentRow.tsx` — row sub-component
- `src/frontend/src/components/CourseColorBadge.tsx` — color indicator
- `src/frontend/src/hooks/useAssignments.ts` — custom hook for data fetching/sync
- `src/frontend/src/__tests__/AssignmentList.test.tsx` — component tests

### Modified Files

- `src/frontend/src/store/assignmentsStore.ts` — Zustand store
- `src/frontend/src/App.tsx` — integrate AssignmentList
- `src/backend/preload/index.ts` — expose `db.assignments.list` and `onDbChanged`

---

## Acceptance Criteria

| #   | Criterion                                               | Verification                          |
| --- | ------------------------------------------------------- | ------------------------------------- |
| 1   | Fetches and displays assignments on mount               | Component test with mock IPC          |
| 2   | Sorted by dueAt ascending (soonest first)               | Test with multiple assignments        |
| 3   | Shows course color badge, title, due date, status badge | Visual regression test                |
| 4   | Due date formatted in local timezone                    | Test with UTC timestamps              |
| 5   | Status badge shows correct label/color                  | Test each status value                |
| 6   | Subscribes to `db:changed` and refreshes                | Test event emission triggers re-fetch |
| 7   | Handles 100+ assignments performantly                   | Profile test (optional)               |
| 8   | Accessible (semantic HTML, keyboard nav)                | axe-core test                         |
| 9   | All tests pass (`pnpm test`)                            | CI run                                |

---

## Notes

- This is the core UI of Phase 1 MVP
- Empty/loading/error states handled in ticket 1.10
- Mark complete interaction in ticket 1.11
- Course grouping is a nice-to-have; minimum viable is flat chronological list
- Date formatting: use `Intl.DateTimeFormat` for locale-aware output

---

## Release Summary

Build AssignmentList component: chronological list with course colors, due dates, status badges
