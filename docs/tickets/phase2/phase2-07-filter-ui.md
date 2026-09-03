---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-07-filter-ui

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 1 day

---

## Description

Build `FilterBar` component: multi-select course chips, status tabs (All/Pending/Completed), date range picker, search input with debounce. Integrates with Zustand `FilterState` slice.

---

## Requirements

### Functional

- [ ] `FilterBar` component rendered above `AssignmentList`
- [ ] **Course filter**: Horizontal scrollable chips — each course shows colored dot + name + count. Click to toggle. "All courses" chip to clear.
- [ ] **Status filter**: Three tabs — All / Pending / Completed. Active tab highlighted.
- [ ] **Date range**: Two date inputs (From / To) with calendar popover. Clear button. Presets: "This Week", "This Month", "Overdue".
- [ ] **Search**: Text input with debounce (300ms), clear button (×), placeholder "Search assignments..."
- [ ] **Clear all**: Button to reset all filters to defaults
- [ ] Responsive: on <1000px, collapse course chips into dropdown; stack date inputs vertically

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Accessible: proper labels, ARIA attributes, keyboard navigation
- [ ] Debounced search input (300ms) — updates store on blur or after delay
- [ ] Course chips show assignment count per course (derived from current assignments)
- [ ] Date picker: use native `<input type="date">` or lightweight picker (no heavy deps)
- [ ] Visual feedback: active filters shown with badge count in toolbar

---

## Designs & Constraints

- **Component location**: `src/frontend/src/components/FilterBar/FilterBar.tsx`
- **Sub-components**: `CourseChips`, `StatusTabs`, `DateRangePicker`, `SearchInput`, `FilterSummary`
- **State**: Consumes `useAssignmentStore` filter actions
- **Course chips**: Sort by assignment count (desc), then alphabetically
- **Date presets**: Calculate ranges in component using `date-fns`
- **Styling**: CSS Modules or Tailwind (per project convention)

### Layout (Toolbar)

```
┌─────────────────────────────────────────────────────────────┐
│ [Search_______________] [Status: ▼All ▸Pending ▸Completed]  │
│ [Course: CS101  MATH200  ENG101  +3 more]  [Date: From ▼ To ▼] [Clear] │
└─────────────────────────────────────────────────────────────┘
```

### Date Presets

| Preset | Start | End |
|--------|-------|-----|
| This Week | Mon 00:00 (local) | Sun 23:59 (local) |
| This Month | 1st 00:00 | Last day 23:59 |
| Overdue | -∞ | Now |
| Upcoming | Now | +∞ |

---

## Code Changes

### New Files

- `src/frontend/src/components/FilterBar/FilterBar.tsx`
- `src/frontend/src/components/FilterBar/CourseChips.tsx`
- `src/frontend/src/components/FilterBar/StatusTabs.tsx`
- `src/frontend/src/components/FilterBar/DateRangePicker.tsx`
- `src/frontend/src/components/FilterBar/SearchInput.tsx`
- `src/frontend/src/components/FilterBar/FilterSummary.tsx`
- `src/frontend/src/components/FilterBar/index.ts` — barrel export
- `src/frontend/src/components/FilterBar/FilterBar.module.css` (or .css)

### Modified Files

- `src/frontend/src/pages/AssignmentListPage.tsx` — insert `FilterBar` above `AssignmentList`

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Course chips toggle filter, show counts | Manual test |
| 2 | Status tabs switch filter correctly | Manual test |
| 3 | Date range picker updates filter, presets work | Manual test |
| 4 | Search input debounced, clears on × | Manual test |
| 5 | Clear all resets all filters | Manual test |
| 6 | Responsive layout works <1000px | Manual test (resize) |
| 7 | Keyboard accessible (tab, enter, escape) | Manual test |
| 8 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- `date-fns` already added in non-coding actions for date calculations
- Course chips: use `course_color` from assignment for colored dot
- "Overdue" preset useful for quick filtering — consider adding to status tabs too
- Search searches: title, course_name, description (client-side)
- Filter summary badge: "3 filters active" with click to expand/show details
- This component works with ticket 2.9 (filter logic) to derive filtered list

---

## Release Summary

Build FilterBar with course chips, status tabs, date range, search — fully accessible and responsive