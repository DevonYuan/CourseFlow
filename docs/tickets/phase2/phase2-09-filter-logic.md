---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-09-filter-logic

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 1 day

---

## Description

Implement memoized selector in Zustand store that derives the filtered, sorted, and grouped assignment list from raw assignments + FilterState. Apply: search → course filter → status filter → date range → sort → group.

---

## Requirements

### Functional

- [ ] Selector `selectFilteredAssignments` in store returning `Assignment[]` (flat) or `GroupedAssignments` (grouped)
- [ ] Filter pipeline (order matters):
  1. **Search**: case-insensitive substring match on `title`, `course_name`, `description`
  2. **Course filter**: include only if `course_name` in `courseFilter` (empty = all)
  3. **Status filter**: `statusFilter === 'pending'` → exclude completed; `'completed'` → only completed
  4. **Date range**: `due_at` within `[start, end]` (inclusive), null bounds ignored
- [ ] Sort pipeline (after filters):
  - `priority`: sort by `priorityOrder` position, then `due_at` for ties
  - `dueDateAsc`: `due_at` ASC (nulls last)
  - `dueDateDesc`: `due_at` DESC (nulls first)
  - `course`: `course_name` ASC, then `due_at` ASC
  - `createdDesc`: `created_at` DESC
- [ ] Grouping (ticket 2.11) applied after sort — returns `GroupedAssignments` type
- [ ] Memoized: recompute only when assignments or FilterState changes

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Performance: O(n log n) for sort, O(n) for filters — fine for <500 items
- [ ] Pure functions for each filter/sort step — testable in isolation
- [ ] Handle null `due_at`, `created_at` gracefully (sort to end)
- [ ] Type-safe: return type matches grouped/flat based on `groupingType`

---

## Designs & Constraints

- **Location**: `src/frontend/src/store/useAssignmentStore.ts` — add selector
- **Dependencies**: `reselect` not needed — use Zustand's built-in `subscribeWithSelector` or simple memoization
- **Grouped type**:
  ```typescript
  type GroupedAssignments = {
    groupKey: string
    groupLabel: string
    assignments: Assignment[]
  }[]
  ```
- **Date comparison**: Use `date-fns` `isWithinInterval`, `parseISO`
- **Search**: Simple `toLowerCase().includes()` — no regex for performance

### Selector Signature

```typescript
// In store
selectFilteredAssignments: () => Assignment[] | GroupedAssignments
```

### Filter Order Rationale

Search first (most restrictive) → Course → Status → Date (least restrictive) — but order doesn't affect correctness, only performance

---

## Code Changes

### New Files

- `src/frontend/src/store/selectors.ts` — pure filter/sort/group functions (testable)

### Modified Files

- `src/frontend/src/store/useAssignmentStore.ts` — add `selectFilteredAssignments` selector using `selectors.ts`
- `src/frontend/src/components/AssignmentList/AssignmentList.tsx` — use selector instead of raw assignments

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Search filters by title/course/description | Unit test |
| 2 | Course filter includes/excludes correctly | Unit test |
| 3 | Status filter shows only pending/completed | Unit test |
| 4 | Date range filters by due_at correctly | Unit test |
| 5 | Each sort option orders correctly | Unit test |
| 6 | Combined filters + sort produce correct result | Unit test |
| 7 | Memoization works (no recompute on unrelated state change) | Unit test |
| 8 | Null due_at handled (sorts to end) | Unit test |
| 9 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- This is the **core logic** connecting FilterBar (2.7), SortDropdown (2.8), Grouping (2.11) to AssignmentList
- Keep selector pure — no side effects, no IPC calls
- Grouping applied in selector but rendering of groups in ticket 2.11
- Consider adding `selectAssignmentCounts` for filter badge counts (total, pending, completed per course)
- Virtualization not needed yet — but selector returns flat or grouped array ready for it

---

## Release Summary

Implement memoized filter/sort/group selector pipeline for assignment list