---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-06-filter-state

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Add `FilterState` slice to Zustand store for managing filter, sort, and grouping state. Includes course multi-select, status tabs, date range, search query, sort option, and grouping type. Persist to `localStorage`.

---

## Requirements

### Functional

- [ ] `FilterState` interface in store:
  ```typescript
  interface FilterState {
    courseFilter: string[]  // course names to include (empty = all)
    statusFilter: 'all' | 'pending' | 'completed'
    dueDateRange: { start: Date; end: Date } | null
    searchQuery: string
    sortOption: 'priority' | 'dueDateAsc' | 'dueDateDesc' | 'course' | 'createdDesc'
    groupingType: 'none' | 'week' | 'status' | 'course'
  }
  ```
- [ ] Actions: `setCourseFilter`, `toggleCourseFilter`, `setStatusFilter`, `setDueDateRange`, `setSearchQuery`, `setSortOption`, `setGroupingType`, `resetFilters`
- [ ] Persist entire `FilterState` to `localStorage` key `courseflow:filters` on every change
- [ ] Hydrate from `localStorage` on store initialization
- [ ] Derived list of unique course names from assignments (for filter options)

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] `localStorage` reads/writes wrapped in try/catch (private browsing, quota exceeded)
- [ ] Debounce search query persistence (300ms) to avoid excessive writes
- [ ] Type-safe: all actions fully typed
- [ ] No circular dependencies

---

## Designs & Constraints

- **Store location**: `src/frontend/src/store/useAssignmentStore.ts` (extend existing)
- **Persistence key**: `courseflow:filters` (JSON string)
- **Debounce**: Use `setTimeout`/`clearTimeout` for search query only
- **Course filter**: Multi-select — user can check/uncheck multiple courses
- **Status filter**: Radio-style — All / Pending / Completed
- **Date range**: Optional — null means no date filtering
- **Sort default**: `'priority'` (custom order)
- **Grouping default**: `'none'`

### localStorage Schema

```json
{
  "courseFilter": ["CS101", "MATH200"],
  "statusFilter": "pending",
  "dueDateRange": { "start": "2026-01-01T00:00:00.000Z", "end": "2026-12-31T23:59:59.999Z" },
  "searchQuery": "homework",
  "sortOption": "priority",
  "groupingType": "week"
}
```

---

## Code Changes

### New Files

- None

### Modified Files

- `src/frontend/src/store/useAssignmentStore.ts` — add `FilterState` slice + actions + persistence
- `src/frontend/src/store/index.ts` — export types if needed

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | All filter actions update state correctly | Unit test |
| 2 | State persists to localStorage on change | Manual test + devtools |
| 3 | State hydrates from localStorage on reload | Manual test |
| 4 | Debounced searchQuery doesn't write on every keystroke | Manual test |
| 5 | Course filter options derived from assignments | Unit test |
| 6 | Invalid localStorage (corrupt JSON) handled gracefully | Unit test |
| 7 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- Filter state is **client-side only** — no backend persistence
- `dueDateRange` uses UTC ISO strings in localStorage, converted to `Date` in state
- `courseFilter` empty array = show all courses (not "none")
- `groupingType` affects rendering only (ticket 2.11), not data fetching
- This store slice will be consumed by `FilterBar` (ticket 2.7) and list selector (ticket 2.9)

---

## Release Summary

Add FilterState slice to Zustand with course, status, date, search, sort, grouping — persisted to localStorage