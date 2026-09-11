---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-08-sort-options

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 0.5 day

---

## Description

Add sort dropdown to toolbar with options: "Priority (custom)", "Due Date (asc)", "Due Date (desc)", "Course (A–Z)", "Created (newest)". Persist sort preference to localStorage via FilterState.

---

## Requirements

### Functional

- [ ] Sort dropdown in toolbar (next to filter bar or integrated)
- [ ] Options:
  - `priority` — "Priority (custom)" — uses `priorityOrder` from drag-drop
  - `dueDateAsc` — "Due Date (soonest first)"
  - `dueDateDesc` — "Due Date (latest first)"
  - `course` — "Course (A–Z)"
  - `createdDesc` — "Created (newest first)"
- [ ] Default: `priority`
- [ ] Selection updates `FilterState.sortOption` and persists to localStorage
- [ ] When grouping active (ticket 2.11), sort applies **within each group**

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Accessible: native `<select>` or accessible combobox pattern
- [ ] Label: "Sort by" with `htmlFor` association
- [ ] Sort option reflected in URL/query params? No — localStorage only for Phase 2

---

## Designs & Constraints

- **Component location**: `src/frontend/src/components/FilterBar/SortDropdown.tsx` (or part of FilterBar)
- **State**: Uses `useAssignmentStore` `setSortOption` action
- **Sort logic**: Applied in ticket 2.9 (selector) — this ticket only UI + state
- **Grouping interaction**: Documented in ticket 2.11 — sort within groups

### Sort Option Labels

| Value         | Label                    |
| ------------- | ------------------------ |
| `priority`    | Priority (custom)        |
| `dueDateAsc`  | Due Date (soonest first) |
| `dueDateDesc` | Due Date (latest first)  |
| `course`      | Course (A–Z)             |
| `createdDesc` | Created (newest first)   |

---

## Code Changes

### New Files

- `src/frontend/src/components/FilterBar/SortDropdown.tsx`

### Modified Files

- `src/frontend/src/components/FilterBar/FilterBar.tsx` — integrate SortDropdown
- `src/frontend/src/store/useAssignmentStore.ts` — sortOption already in FilterState (ticket 2.6)

---

## Acceptance Criteria

| #   | Criterion                                        | Verification                |
| --- | ------------------------------------------------ | --------------------------- |
| 1   | Dropdown shows all 5 options with correct labels | Manual test                 |
| 2   | Selection updates store and persists             | Manual test + localStorage  |
| 3   | Default is "Priority (custom)"                   | Manual test (fresh install) |
| 4   | Accessible: label, keyboard, screen reader       | Manual test                 |
| 5   | All tests pass (`pnpm test`)                     | CI run                      |

---

## Notes

- Sort is **client-side** — applied to filtered list in selector (ticket 2.9)
- "Priority (custom)" only meaningful when user has reordered; otherwise same as dueDateAsc
- When grouping by "Week"/"Status"/"Course", sort applies within each group section
- Consider adding "Completed first/last" as secondary sort (deferred)
- No backend changes needed — purely frontend

---

## Release Summary

Add sort dropdown with 5 options (Priority, Due Date ↑/↓, Course, Created) — persisted to localStorage
