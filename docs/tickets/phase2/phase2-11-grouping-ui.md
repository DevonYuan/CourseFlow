---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-11-grouping-ui

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 1 day

---

## Description

Add grouping selector to toolbar (icon + label). Render grouped list with collapsible section headers showing assignment count. Within each group, respect current sort order.

---

## Requirements

### Functional

- [ ] Grouping selector in toolbar: dropdown with options — None / This Week / Overdue / Upcoming / Completed / By Course
- [ ] Selector updates `FilterState.groupingType` (ticket 2.6)
- [ ] `AssignmentList` renders grouped view when `groupingType !== 'none'`
- [ ] Each group: collapsible header with label + count (e.g., "This Week (5)")
- [ ] Click header → toggle collapse/expand (persist per-group? No, session only)
- [ ] Default: all groups expanded
- [ ] Empty groups hidden
- [ ] Drag-drop reordering (ticket 2.3) works **within group only** when grouped
- [ ] Visual: group header distinct (background, typography), indent assignments

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Accessible: headers are `<button>` with `aria-expanded`, `aria-controls`
- [ ] Keyboard: Enter/Space toggles collapse, arrows navigate between groups
- [ ] Smooth collapse/expand animation (CSS transition)
- [ ] Responsive: on mobile, groups stack full-width

---

## Designs & Constraints

- **Component location**: `src/frontend/src/components/AssignmentList/GroupedAssignmentList.tsx` (new) or extend `AssignmentList.tsx`
- **Grouping selector**: `src/frontend/src/components/FilterBar/GroupingSelector.tsx`
- **State**: `groupingType` from store; per-group expanded state in component local state
- **Data**: Consumes `selectFilteredAssignments` which returns `GroupedAssignments` (ticket 2.9)
- **Drag-drop in groups**: `@dnd-kit` `SortableContext` per group — each group has own context

### Grouping Selector Options

| Value    | Label                          | Icon |
| -------- | ------------------------------ | ---- |
| `none`   | Flat List                      | ☰   |
| `week`   | This Week / Overdue / Upcoming | 📅   |
| `status` | Pending / Completed            | ✓    |
| `course` | By Course                      | 🎓   |

### Group Header Structure

```tsx
<button
  className="group-header"
  onClick={() => toggleGroup(groupKey)}
  aria-expanded={isExpanded}
  aria-controls={`group-${groupKey}`}
>
  <span className="group-label">{groupLabel}</span>
  <span className="group-count">{count}</span>
  <ChevronIcon rotated={!isExpanded} />
</button>
```

---

## Code Changes

### New Files

- `src/frontend/src/components/FilterBar/GroupingSelector.tsx`
- `src/frontend/src/components/AssignmentList/GroupedAssignmentList.tsx`
- `src/frontend/src/components/AssignmentList/GroupHeader.tsx`

### Modified Files

- `src/frontend/src/components/FilterBar/FilterBar.tsx` — add GroupingSelector
- `src/frontend/src/pages/AssignmentListPage.tsx` — render GroupedAssignmentList when grouped
- `src/frontend/src/components/AssignmentList/AssignmentList.tsx` — handle grouped vs flat rendering

---

## Acceptance Criteria

| #   | Criterion                                        | Verification       |
| --- | ------------------------------------------------ | ------------------ |
| 1   | Grouping selector changes view correctly         | Manual test        |
| 2   | Groups render with correct labels and counts     | Manual test        |
| 3   | Collapse/expand works per group                  | Manual test        |
| 4   | Drag-drop works within group (not across groups) | Manual test        |
| 5   | Sort within group respected                      | Manual test        |
| 6   | Empty groups hidden                              | Manual test        |
| 7   | Accessible: headers announce expanded/collapsed  | Screen reader test |
| 8   | All tests pass (`pnpm test`)                     | CI run             |

---

## Notes

- When grouped, drag-drop **only within group** — user can't drag from "This Week" to "Overdue" (would change due date, not priority)
- Priority reordering still global — `priorityOrder` positions are absolute across all assignments
- But visually, drag handle only appears within group context
- Consider: if user drags in grouped view, update global `priorityOrder` — positions shift globally
- Grouping selector persists to localStorage (ticket 2.12)
- "Completed" group: show completed assignments regardless of due date

---

## Release Summary

Add grouping selector and collapsible grouped list rendering with drag-drop within groups
