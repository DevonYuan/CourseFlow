---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-10-grouping-types

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 0.5 day

---

## Description

Define `GroupingType` and grouping logic types. Implement pure functions to group assignments by: "This Week" (due in next 7 days), "Overdue" (due < now & pending), "Upcoming" (due > 7 days), "Completed" (status done), "By Course". All boundaries in user's local timezone.

---

## Requirements

### Functional

- [ ] `GroupingType` type: `'none' | 'week' | 'status' | 'course'`
- [ ] Grouping functions in `src/frontend/src/store/grouping.ts`:
  - `groupByWeek(assignments: Assignment[]): GroupedAssignments`
  - `groupByStatus(assignments: Assignment[]): GroupedAssignments`
  - `groupByCourse(assignments: Assignment[]): GroupedAssignments`
- [ ] Group definitions:
  - **This Week**: `due_at` between Monday 00:00 and Sunday 23:59 (local TZ)
  - **Overdue**: `due_at` < now AND status !== 'completed'
  - **Upcoming**: `due_at` > Sunday 23:59 (local TZ)
  - **Completed**: status === 'completed' (regardless of due date)
  - **No Due Date**: assignments without `due_at` — separate group
  - **By Course**: group by `course_name`, sorted alphabetically
- [ ] Within each group, respect current `sortOption` (ticket 2.8)
- [ ] Group order fixed: This Week → Overdue → Upcoming → No Due Date → Completed (for week/status)
- [ ] Course groups sorted A–Z

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Timezone handling: use `date-fns-tz` or `Intl.DateTimeFormat` for local TZ boundaries
- [ ] Pure functions — no side effects, fully testable
- [ ] Handle null `due_at` gracefully (go to "No Due Date" group)
- [ ] Group labels localized? English only for Phase 2

---

## Designs & Constraints

- **Location**: `src/frontend/src/store/grouping.ts` (pure functions)
- **Dependencies**: `date-fns`, `date-fns-tz` (or native `Intl`)
- **Timezone**: User's local timezone (browser `Intl.DateTimeFormat().resolvedOptions().timeZone`)
- **Week boundary**: Monday 00:00 to Sunday 23:59 (ISO week)
- **Now**: `new Date()` at time of grouping (client-side)

### GroupedAssignments Type

```typescript
interface GroupedAssignments {
  groupKey: string        // 'this-week', 'overdue', 'upcoming', 'no-due-date', 'completed', or course name
  groupLabel: string      // 'This Week', 'Overdue', 'Upcoming', 'No Due Date', 'Completed', or course name
  assignments: Assignment[]
  count: number           // assignments.length
}
```

### Week Grouping Logic

```typescript
function groupByWeek(assignments: Assignment[]): GroupedAssignments {
  const now = new Date()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const monday = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const sunday = endOfWeek(now, { weekStartsOn: 1 })
  
  // Groups in order
  const groups = [
    { key: 'this-week', label: 'This Week', filter: (a) => a.due_at && isWithinInterval(parseISO(a.due_at), { start: monday, end: sunday }) },
    { key: 'overdue', label: 'Overdue', filter: (a) => a.due_at && parseISO(a.due_at) < now && a.status !== 'completed' },
    { key: 'upcoming', label: 'Upcoming', filter: (a) => a.due_at && parseISO(a.due_at) > sunday },
    { key: 'no-due-date', label: 'No Due Date', filter: (a) => !a.due_at },
    { key: 'completed', label: 'Completed', filter: (a) => a.status === 'completed' },
  ]
  
  return groups.map(g => ({
    groupKey: g.key,
    groupLabel: g.label,
    assignments: assignments.filter(g.filter).sort(sortFn),
    count: assignments.filter(g.filter).length
  })).filter(g => g.count > 0)
}
```

---

## Code Changes

### New Files

- `src/frontend/src/store/grouping.ts` — pure grouping functions + types

### Modified Files

- `src/frontend/src/store/useAssignmentStore.ts` — import and use in selector (ticket 2.9)
- `src/frontend/src/store/selectors.ts` — call grouping functions based on `groupingType`

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `groupByWeek` correctly categorizes assignments by week boundaries | Unit test (multiple TZs) |
| 2 | `groupByStatus` separates pending/completed correctly | Unit test |
| 3 | `groupByCourse` groups by course_name A–Z | Unit test |
| 4 | Null due_at → "No Due Date" group | Unit test |
| 5 | Completed assignments always in "Completed" group (week/status) | Unit test |
| 6 | Sort option applied within each group | Unit test |
| 7 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- "This Week" = current ISO week (Mon-Sun) — not rolling 7 days from today
- Overdue excludes completed — completed goes to "Completed" group
- Timezone: critical for correct "This Week" / "Overdue" boundaries
- `date-fns-tz` adds ~50KB — consider native `Intl` + `date-fns` UTC conversion to avoid extra dep
- Grouping is **client-side only** — no backend changes
- This feeds into ticket 2.11 (UI rendering)

---

## Release Summary

Define grouping types and pure functions for Week, Status, Course grouping with timezone-aware boundaries