---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-04-priority-persist

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Ensure priority order persists across app restarts and survives iCal re-imports. On app load, hydrate assignment list sorted by `priority_order.position` (fallback: due date). On iCal re-import, never overwrite local priority — only update `due_at`, `title`, `workflow_state` from Canvas.

---

## Requirements

### Functional

- [ ] On app startup (renderer), fetch `priorityOrder` via `db:priority:list` and apply to Zustand store before rendering
- [ ] Assignment list default sort: by `priorityOrder` position (assignments with priority entries first, then by due date)
- [ ] On iCal import (backend `ical:import` handler), for each incoming assignment:
  - If `ical_uid` matches existing assignment: update `due_at`, `title`, `workflow_state`, `description` (from Canvas)
  - **Do NOT update**: `priority_order.position`, `notes`, `subtasks`, `course_color` (user-owned fields)
  - If new assignment (no `ical_uid` match): insert with `priority_order` entry at end (max position + 1)
- [ ] When assignment deleted (user action), cascade delete `priority_order` entry (via FK, already in schema)
- [ ] When all assignments cleared (reset), clear `priority_order` table

### Non-Functional

- [ ] Hydration completes before first render (use React `useEffect` with async or Suspense)
- [ ] Re-import preserves user's custom ordering 100%
- [ ] New assignments appended to priority list (lowest priority) — user drags up if important
- [ ] Zero `any` in implementation

---

## Designs & Constraints

- **Hydration**: In `App.tsx` or layout component, `useEffect` → `window.api.db.priority.list()` → `store.setPriorityOrder(ids)`
- **Fallback sort**: Assignments without priority entry sort by `due_at ASC` (soonest first) after prioritized ones
- **Re-import logic**: In `src/backend/main/ical/import.ts` (ticket 1.4 from Phase 1), modify upsert to exclude priority/notes/subtasks
- **New assignment priority**: `INSERT INTO priority_order (assignment_id, position) VALUES (?, (SELECT COALESCE(MAX(position), -1) + 1 FROM priority_order))`

### Priority Hydration Flow

```
App Start
    │
    ▼
Fetch assignments (db:assignments:list)
    │
    ▼
Fetch priority order (db:priority:list)
    │
    ▼
Merge: assignments with priority → sort by position
       assignments without priority → sort by due_at
    │
    ▼
Set Zustand store (assignments + priorityOrder)
    │
    ▼
Render
```

---

## Code Changes

### New Files

- None

### Modified Files

- `src/frontend/src/App.tsx` or layout — add hydration `useEffect`
- `src/frontend/src/store/useAssignmentStore.ts` — add `hydrate(assignments, priorityOrder)` action
- `src/backend/main/ical/import.ts` — modify upsert to preserve priority/notes/subtasks
- `src/backend/main/db/repository.ts` — ensure `AssignmentRepository.upsert` doesn't touch `priority_order`

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | App restart → assignments render in custom priority order | Manual test |
| 2 | New iCal import → existing assignments keep custom positions | Manual test |
| 3 | New assignments from import appear at bottom of list | Manual test |
| 4 | Deleted assignment → priority entry removed | Manual test |
| 5 | No priority entries → fallback to due date sort | Manual test |
| 6 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- This is the **core guarantee** of Phase 2: user's priority order is sacred
- Phase 1 ticket 1.4 (`ical:import`) must be updated — coordinate with that implementation
- `course_color` is also user-owned (set in Settings) — preserve on re-import
- Consider adding `last_synced_at` to assignments for debugging re-import behavior
- If user manually reorders after import, new order persists (handled by ticket 2.3)

---

## Release Summary

Persist priority order across restarts and protect it from iCal re-import overwrites