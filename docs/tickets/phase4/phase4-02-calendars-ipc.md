# Ticket: phase4-02-calendars-ipc

## Title
**IPC Handlers for Calendars**

## Description
Implement `db:calendars:list`, `get`, `create`, `update`, `delete`, `reorder`, `setEnabled` in `ipc-handlers.ts`. Emit `db:changed` for `calendars` table.

## Acceptance Criteria
- [ ] All 7 calendar IPC handlers registered in `src/backend/main/ipc-handlers.ts`
- [ ] Handlers use repository methods from ticket 4.1
- [ ] Handlers return `IpcResult<T>` (ok/error wrapper)
- [ ] Handlers validate input (non-empty name, valid URL format for feed_url, valid hex color)
- [ ] `db:changed` events emitted with correct payload:
  - `create` → `{ table: 'calendars', action: 'insert', id }`
  - `update` → `{ table: 'calendars', action: 'update', id }`
  - `delete` → `{ table: 'calendars', action: 'delete', id }`
  - `reorder` → `{ table: 'calendars', action: 'reorder', id: 'all' }` (or individual)
  - `setEnabled` → `{ table: 'calendars', action: 'update', id }`
- [ ] Error handling: `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT` (duplicate name?)
- [ ] Unit tests for all handlers (mock repository)

## Technical Details

### Handler Pattern
```typescript
// Example: db:calendars:create
ipcMain.handle('db:calendars:create', async (_event, input: CalendarSourceInput): Promise<IpcResult<CalendarSource>> => {
  // Validate
  if (!input.name?.trim()) return { ok: false, error: 'Name required', code: 'VALIDATION_ERROR' };
  if (!input.feed_url?.trim()) return { ok: false, error: 'Feed URL required', code: 'VALIDATION_ERROR' };
  try { new URL(input.feed_url); } catch { return { ok: false, error: 'Invalid URL', code: 'VALIDATION_ERROR' }; }
  if (input.color && !/^#[0-9a-fA-F]{6}$/.test(input.color)) return { ok: false, error: 'Invalid color', code: 'VALIDATION_ERROR' };

  // Delegate to repository
  const calendar = await repo.createCalendar(input);
  
  // Emit event
  sendEventToRenderers('db:changed', { table: 'calendars', action: 'insert', id: calendar.id });
  
  return { ok: true, data: calendar };
});
```

### Validation Rules
- `name`: required, 1-100 chars, trimmed
- `feed_url`: required, valid URL (http/https), trimmed
- `color`: optional, if provided must match `/^#[0-9a-fA-F]{6}$/`
- `enabled`: optional, defaults to `true`
- `position`: optional, defaults to append

### Duplicate Name Handling
- Allow duplicate names? **Recommendation:** Yes (user may have "Work Calendar" and "Personal Work Calendar")
- If disallowing: add UNIQUE constraint on `name` + handle `CONFLICT` error code

## Dependencies
- Requires: `phase4-01-calendars-schema` (repository methods)

## Testing
- Unit test: Each handler with valid input → returns ok + data
- Unit test: Each handler with invalid input → returns error with correct code
- Unit test: `create` → emits `db:changed` with action 'insert'
- Unit test: `update` → emits `db:changed` with action 'update'
- Unit test: `delete` → emits `db:changed` with action 'delete'
- Unit test: `reorder` → emits `db:changed` with action 'reorder'

## Related
- `phase4-01-calendars-schema` — Repository
- `phase4-03-calendars-preload` — Preload bridge
- `src/backend/shared/ipc.ts` — Channel definitions (from ticket 4.0)