# Ticket: phase4-08-unified-list-ui

## Title
**Unified Assignment List with Attribution**

## Description
Update `AssignmentList` to show color badge per assignment (from `CalendarSource.color`). Add source filter to FilterBar (multi-select calendar chips). Grouping "By Calendar" option. TopBar shows per-source sync status (spinner, last sync time, error).

## Acceptance Criteria
- [x] Assignment rows show 8px color badge (left of title) from `CalendarSource.color`
- [x] FilterBar: new "Calendars" multi-select chip group (like course filter)
- [x] Grouping dropdown adds "By Calendar" option
- [x] TopBar sync status area: shows each enabled calendar with:
  - Name + color badge
  - Status: idle / syncing (spinner) / last sync time / error
  - Click to trigger manual sync for that source
- [x] Assignments without `source_id` (legacy/manual) show neutral badge
- [x] All filters/grouping work together (calendar + course + status + date range)
- [x] Keyboard accessible

## Technical Details

### Assignment Row Color Badge
```tsx
// In AssignmentRow.tsx
const calendar = useCalendarSource(assignment.source_id); // from calendarsStore
const badgeColor = calendar?.color || 'var(--ink-faint)'; // Neutral for manual/legacy

<div className="assignment-row__calendar-badge" style={{ backgroundColor: badgeColor }} />
```

### FilterBar Extension
```tsx
// In FilterBar.tsx - add CalendarFilter component
<CalendarFilter
  calendars={enabledCalendars} // from calendarsStore
  selected={filterState.calendarIds}
  onChange={ids => setFilterState(prev => ({ ...prev, calendarIds: ids }))}
/>

// CalendarFilter: multi-select chips like CourseFilter
```

### Grouping: "By Calendar"
```typescript
// In grouping logic (phase2-10-grouping-types)
type GroupingType = 'none' | 'week' | 'status' | 'course' | 'calendar'; // ADD 'calendar'

// Group key for calendar grouping:
function getCalendarGroupKey(assignment: Assignment): string {
  const cal = calendarsMap.get(assignment.source_id);
  return cal?.name || 'Uncategorized';
}

// Section order: by calendar position (from CalendarSource.position)
```

### TopBar Sync Status
```tsx
// In TopBar.tsx - extend existing sync status
<SyncStatus>
  {enabledCalendars.map(cal => (
    <CalendarSyncStatus key={cal.id} calendar={cal} />
  ))}
</SyncStatus>

// CalendarSyncStatus component:
// - Idle: color badge + name + "Synced 5 min ago"
// - Syncing: color badge + name + spinner + "Syncing..."
// - Error: color badge + name + error icon + "Failed: auth" (tooltip shows full message)
// - Click (when not syncing) → trigger `scheduler:trigger` for that sourceId
```

### Store Integration
- Extend `assignmentsStore` or create selector that joins assignments with calendar colors
- `calendarsStore` provides `calendarsMap: Map<string, CalendarSource>`
- Memoized selector for filtered/sorted/grouped list includes calendar info

## Dependencies
- Requires: `phase4-03-calendars-preload` (calendars IPC)
- Requires: `phase4-06-scheduler-multi` (per-source sync status events)
- Requires: Phase 2 filter/grouping infrastructure

## Testing
- Component test: AssignmentRow shows correct color badge
- Component test: CalendarFilter filters assignments correctly
- Component test: "By Calendar" grouping renders sections in position order
- Component test: TopBar shows per-source status with correct states
- E2E test: Multi-calendar sync → list updates with color badges
- E2E test: Filter by calendar + course + status works together

## Related
- `phase4-06-scheduler-multi` — Sync status events
- `phase4-07-calendars-settings-ui` — Calendar management
- `docs/architecture/multi-calendar.md` — UI design

---

## Implementation Status

Implemented. Deviations and fixes discovered while debugging:

**Per-source manual sync (deviation).** The ticket's sketch used `scheduler:trigger` for a
single `sourceId`, but that channel was `request: void`. The contract now accepts an optional
`{ sourceId?: string }`, the preload passes it through, `Scheduler.triggerManual(sourceId?)`
and `runFetchCycle(onlySources?)` sync only that source, and the TopBar popover passes
`{ sourceId }` per calendar. Omitting the argument preserves the original sync-all behaviour.

**Infinite loading loop (fixed).** `CalendarList`'s mount effect re-fetched whenever
`calendars.length === 0 && !isLoading`. Because a completed fetch flips `isLoading` back to
`false` while the list is still empty, the condition re-fired forever and the skeleton stayed
on screen — the list looked permanently stuck loading. The store now exposes `hasFetched`
(set on success *and* failure) so "empty" is a stable loaded state; the skeleton only renders
for the initial load. `fetchCalendars` also de-duplicates concurrent requests.

**TDZ crash below 1000px (fixed).** `CalendarFilter` referenced `isAllSelected` inside the
mobile early-return branch before its `const` declaration, throwing
"Cannot access 'isAllSelected' before initialization" at narrow window widths.

**Un-awaited calendar delete (fixed).** `db:calendars:delete` called the async
`repo.deleteCalendar` without awaiting it, so the handler reported success before the row was
removed.

**Duplicate rows on create (fixed).** `handleDbChanged` appended the fetched calendar instead
of upserting by id; the `db:changed` insert event and `optimisticCreate`'s temp→real swap can
arrive in either order, producing a duplicate row.

**Missing `calendars` in the global `window.api` type.** `src/frontend/src/global.d.ts`
did not declare `window.api.db.calendars`, which hid the type errors above. Added.

Tests: `src/frontend/src/components/calendars/__tests__/CalendarList.test.tsx` (3 cases,
including a regression test for the refetch loop that hangs the suite if the old condition is
restored). Full unit suite: 58 files / 787 tests green; typecheck, lint, and
`electron-vite build` all pass.