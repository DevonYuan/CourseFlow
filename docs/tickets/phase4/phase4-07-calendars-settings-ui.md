# Ticket: phase4-07-calendars-settings-ui

## Title
**Calendars Management UI**

## Description
Settings page: list calendars (name, color badge, enabled toggle, last sync, error), "Add Calendar" modal (name, iCal URL, color picker), drag-reorder, delete with confirmation. Persist to `calendars` table via new IPC.

## Acceptance Criteria
- [ ] Settings page has "Calendars" section/tab
- [ ] Calendar list renders: name, color badge (12px circle), enabled toggle, last sync time (relative), error badge (if any)
- [ ] "Add Calendar" button opens modal with form: name (required), iCal URL (required, URL validation), color picker (12-color palette + custom)
- [ ] Drag-and-drop reordering of calendar list (using `@dnd-kit`)
- [ ] Delete calendar: confirmation modal, soft-delete (sets `enabled=false`), or hard delete with assignment reassignment prompt
- [ ] All mutations via `window.api.db.calendars.*` IPC
- [ ] Optimistic UI updates with rollback on error
- [ ] Toast notifications for create/update/delete/reorder
- [ ] Keyboard accessible (Tab navigation, Enter/Space to activate, Escape to close modals)
- [ ] Responsive: works at min-width 800px

## Technical Details

### Components
```
SettingsPage/
  CalendarsSection/
    CalendarList/
      CalendarRow/          // name, color badge, toggle, last sync, error, drag handle, delete btn
      CalendarRowSkeleton/  // loading state
    AddCalendarModal/
      CalendarForm/         // name input, URL input, color picker
    DeleteConfirmModal/     // reusable (from phase3)
```

### State Management
- Use existing `settingsStore` or create `calendarsStore` (Zustand)
- Store: `calendars: CalendarSource[]`, `isLoading`, `error`
- Actions: `fetchCalendars()`, `createCalendar()`, `updateCalendar()`, `deleteCalendar()`, `reorderCalendars()`, `setEnabled()`

### Color Picker
- 12 predefined colors (same palette as course colors): `#3b82f6`, `#ef4444`, `#22c55e`, `#f59e0b`, `#8b5cf6`, `#ec4899`, `#06b6d4`, `#84cc16`, `#f97316`, `#6366f1`, `#14b8a6`, `#a855f7`
- Custom color input (type="color") for advanced users
- Preview shows selected color

### Last Sync Display
- Format: "Just now", "2 min ago", "1 hour ago", "Yesterday", "Jan 15, 2024"
- Use `date-fns` `formatDistanceToNow` or similar

### Error Display
- If `last_error` present: show red badge with error message tooltip
- Error codes: `network`, `auth`, `parse`, `server`, `unknown`
- User-friendly messages: "Connection failed", "Invalid URL / unauthorized", "Feed format error", "Server error", "Unknown error"

### Drag-and-Drop
- Use `@dnd-kit/sortable` (already in project from Phase 2)
- Drag handle on left of row
- On drop: `calendarsStore.reorderCalendars(newOrder)` → IPC `db:calendars:reorder`

## Dependencies
- Requires: `phase4-03-calendars-preload` (IPC bridge)
- Requires: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (already installed)

## Testing
- Component test: CalendarList renders correctly with mock data
- Component test: AddCalendarModal validates URL, creates calendar via IPC
- Component test: Delete confirmation works, soft-deletes calendar
- Component test: Drag-reorder updates order via IPC
- E2E test: Full flow — add calendar, verify in list, reorder, delete
- Accessibility test: axe-core scan on Settings page

## Related
- `phase4-03-calendars-preload` — IPC bridge
- `phase4-08-unified-list-ui` — Unified list uses calendar colors
- `docs/architecture/accessibility.md` — WCAG 2.1 AA standards