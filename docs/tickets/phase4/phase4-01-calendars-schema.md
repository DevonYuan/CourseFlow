# Ticket: phase4-01-calendars-schema

## Title
**CalendarSource Schema & Repository**

## Description
Add `calendars` table: `id`, `name`, `feed_url` (encrypted), `enabled`, `color`, `position`, `last_sync_at`, `next_sync_at`, `last_error`, `created_at`, `updated_at`. Extend repository with CRUD + reorder.

## Acceptance Criteria
- [ ] `calendars` table created via migration v6 (see ticket 4.0)
- [ ] `CalendarSource` mapper in `src/backend/main/db/repository.ts` (row → type)
- [ ] Repository methods implemented:
  - `listCalendars(): Promise<CalendarSource[]>` — ordered by `position`
  - `getCalendar(id: string): Promise<CalendarSource | null>`
  - `createCalendar(input: CalendarSourceInput): Promise<CalendarSource>` — encrypts `feed_url`, assigns position
  - `updateCalendar(id: string, input: CalendarSourceUpdateInput): Promise<CalendarSource>` — re-encrypts `feed_url` if changed
  - `deleteCalendar(id: string): Promise<void>` — cascades? (decide: soft delete or reassign assignments)
  - `reorderCalendars(ids: string[]): Promise<void>` — negative-offset technique
  - `setCalendarEnabled(id: string, enabled: boolean): Promise<CalendarSource>`
- [ ] All methods emit `db:changed` events with `table: 'calendars'`
- [ ] Unit tests for all CRUD operations

## Technical Details

### Mapper
```typescript
function mapCalendarSource(row: any): CalendarSource {
  return {
    id: row.id,
    name: row.name,
    feed_url: row.feed_url,  // stays encrypted in repo; decrypt only when needed for fetch
    enabled: Boolean(row.enabled),
    color: row.color,
    position: row.position,
    last_sync_at: row.last_sync_at,
    next_sync_at: row.next_sync_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
```

### Encryption
- Use existing `encryptSetting(plaintext: string)` / `decryptSetting(encrypted: string)` from `src/backend/main/security/encryption.ts`
- `createCalendar` / `updateCalendar` encrypt `feed_url` before insert/update
- `getCalendar` / `listCalendars` return encrypted `feed_url` (decrypt in scheduler/import only)

### Position Management
- `createCalendar`: `position = (SELECT COALESCE(MAX(position), -1) + 1 FROM calendars)`
- `reorderCalendars`: Use two-phase negative offset (same as `reorderPriority`) to avoid UNIQUE constraint violation

### Delete Behavior
**Decision needed:** When deleting a calendar source:
- Option A: Soft delete (`enabled = 0`, keep data for history)
- Option B: Hard delete + set `assignments.source_id = NULL` (orphan assignments)
- Option C: Hard delete + delete associated assignments (destructive)
**Recommendation:** Option A (soft delete) — preserves sync history, user can re-enable

## Dependencies
- Requires: `phase4-00-data-model-update` (types, migration, IPC contracts)

## Testing
- Unit test: `createCalendar` encrypts feed_url, assigns position
- Unit test: `updateCalendar` re-encrypts when feed_url changes
- Unit test: `reorderCalendars` handles move up/down/top/bottom correctly
- Unit test: `deleteCalendar` soft-deletes (enabled=0) and emits event
- Unit test: `listCalendars` returns ordered by position

## Related
- `phase4-00-data-model-update` — Types, migration, IPC
- `phase4-02-calendars-ipc` — IPC handlers
- `phase4-03-calendars-preload` — Preload bridge