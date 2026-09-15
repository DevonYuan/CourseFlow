# Ticket: phase4-08-unified-list-ui

## Title
**Unified Assignment List with Attribution**

## Description
Update `AssignmentList` to show color badge per assignment (from `CalendarSource.color`). Add source filter to FilterBar (multi-select calendar chips). Grouping "By Calendar" option. TopBar shows per-source sync status (spinner, last sync time, error).

## Acceptance Criteria
- [ ] Assignment rows show 8px color badge (left of title) from `CalendarSource.color`
- [ ] FilterBar: new "Calendars" multi-select chip group (like course filter)
- [ ] Grouping dropdown adds "By Calendar" option
- [ ] TopBar sync status area: shows each enabled calendar with:
  - Name + color badge
  - Status: idle / syncing (spinner) / last sync time / error
  - Click to trigger manual sync for that source
- [ ] Assignments without `source_id` (legacy/manual) show neutral badge
- [ ] All filters/grouping work together (calendar + course + status + date range)
- [ ] Keyboard accessible

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