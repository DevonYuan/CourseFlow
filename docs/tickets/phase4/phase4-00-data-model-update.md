# Ticket: phase4-00-data-model-update

## Title
**Data Model & IPC Alignment for Multi-Calendar**

## Description
Extend shared types, IPC contracts, database schema, and repository mappers for `CalendarSource` entity. Add `source_id` FK to `assignments`. Run migration v6. **All other tickets depend on this.**

## Acceptance Criteria
- [ ] `CalendarSource` type defined in `src/backend/shared/types.ts`
- [ ] `CalendarSourceInput`, `CalendarSourceUpdateInput` types defined
- [ ] `calendars` table added to migration v6 SQL
- [ ] `assignments.source_id` column added (nullable FK → `calendars.id`)
- [ ] Index on `assignments(source_id, ical_uid)` for per-source dedupe
- [ ] Repository mappers updated for `CalendarSource` CRUD
- [ ] IPC channels `db:calendars:*` added to `src/backend/shared/ipc.ts`
- [ ] Migration v6 runs successfully on clean and existing databases
- [ ] Existing `settings.icalUrl` can be decrypted and migrated to `calendars` table

## Technical Details

### New Types (src/backend/shared/types.ts)
```typescript
interface CalendarSource {
  id: EntityId;
  name: string;
  feed_url: string;           // encrypted JSON envelope (same format as settings.icalUrl)
  enabled: boolean;
  color: string;              // hex color, e.g. "#3b82f6"
  position: number;           // display order
  last_sync_at: number | null;  // Unix ms
  next_sync_at: number | null;  // Unix ms
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

interface CalendarSourceInput {
  name: string;
  feed_url: string;           // plaintext URL - will be encrypted in repo
  enabled?: boolean;          // default true
  color?: string;             // default: deterministic hash from name
  position?: number;          // default: append to end
}

interface CalendarSourceUpdateInput {
  name?: string;
  feed_url?: string;          // plaintext URL - will be encrypted in repo
  enabled?: boolean;
  color?: string;
  position?: number;
}
```

### Migration v6 (src/backend/main/db/migrations/006_calendars.sql)
```sql
-- Calendar sources table
CREATE TABLE calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,          -- encrypted JSON envelope
  enabled INTEGER NOT NULL DEFAULT 1,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  last_sync_at INTEGER,
  next_sync_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Add source_id to assignments (nullable for backward compat during migration)
ALTER TABLE assignments ADD COLUMN source_id TEXT REFERENCES calendars(id);

-- Index for per-source dedupe: (source_id, ical_uid)
CREATE INDEX idx_assignments_source_ical ON assignments(source_id, ical_uid);

-- Seed initial calendar from settings.icalUrl (handled in migration runner JS)
```

### Repository Changes (src/backend/main/db/repository.ts)
- Add `CalendarSource` mapper (row → type)
- Add CRUD: `listCalendars()`, `getCalendar(id)`, `createCalendar(input)`, `updateCalendar(id, input)`, `deleteCalendar(id)`, `reorderCalendars(ids[])`, `setCalendarEnabled(id, enabled)`
- Update `importAssignments` to accept `sourceId` parameter
- Update `Assignment` mapper to include `source_id`

### IPC Contract (src/backend/shared/ipc.ts)
Add to `IpcChannels`:
- `db:calendars:list` — `void` → `CalendarSource[]`
- `db:calendars:get` — `string` → `CalendarSource | null`
- `db:calendars:create` — `CalendarSourceInput` → `CalendarSource`
- `db:calendars:update` — `CalendarSourceUpdateInput` → `CalendarSource`
- `db:calendars:delete` — `string` → `void`
- `db:calendars:reorder` — `string[]` → `void`
- `db:calendars:setEnabled` — `{ id: string; enabled: boolean }` → `CalendarSource`

Add `CalendarSource`, `CalendarSourceInput`, `CalendarSourceUpdateInput` to payload types.

## Dependencies
- Must complete before: **all other Phase 4 tickets**

## Implementation Notes
- Encryption: Reuse existing `encryptSetting`/`decryptSetting` from `src/backend/main/security/encryption.ts` for `feed_url`
- Migration seeding: Read `settings.icalUrl`, decrypt, create `CalendarSource` with name "Primary Calendar", re-encrypt into `calendars.feed_url`
- Backfill: For each assignment with `source='ical'`, match `source_url` to new calendar's decrypted `feed_url`, set `source_id`
- Keep `settings.icalUrl` for backward compat (read-only, deprecated)
- Position: Use `MAX(position) + 1` for new calendars; reorder uses negative-offset technique (see `reorderPriority`)

## Testing
- Unit test: Migration v6 runs on clean DB → tables created, indexes exist
- Unit test: Migration v6 runs on DB with existing `settings.icalUrl` → calendar seeded, assignments backfilled
- Unit test: `importAssignments` with `sourceId` scopes dedupe correctly
- Unit test: Calendar CRUD + reorder emits `db:changed` events

## Related
- `docs/architecture/multi-calendar.md` — Design spec
- `docs/architecture/data-model.md` — Entity definitions
- `docs/architecture/ipc-contract.md` — Channel definitions
- `docs/architecture/security.md` — Encryption format