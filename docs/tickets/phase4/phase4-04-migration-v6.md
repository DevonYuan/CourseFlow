# Ticket: phase4-04-migration-v6

## Title
**Database Migration v6**

## Description
Create migration: `calendars` table + `assignments.source_id` FK (nullable). Seed one `calendars` row from existing `settings.icalUrl` (decrypt → re-encrypt into `calendars.feed_url`). Backfill `assignments.source_id` by matching `source_url`. Add index on `assignments(source_id, ical_uid)`.

## Acceptance Criteria
- [ ] Migration file: `src/backend/main/db/migrations/006_calendars.sql`
- [ ] Migration runner executes it on app startup (idempotent)
- [ ] `calendars` table created with all columns + indexes
- [ ] `assignments.source_id` column added (nullable, FK to calendars.id)
- [ ] Index `idx_assignments_source_ical` on `assignments(source_id, ical_uid)` created
- [ ] Seeding logic: If `settings.icalUrl` exists and `calendars` table empty:
  - Decrypt `settings.icalUrl` using existing encryption module
  - Create `CalendarSource` with:
    - `name`: "Primary Calendar" (or derive from feed)
    - `feed_url`: re-encrypted decrypted URL
    - `enabled`: true
    - `color`: deterministic hash from name
    - `position`: 0
    - `created_at`/`updated_at`: now
- [ ] Backfill: For each assignment where `source = 'ical'`:
  - Match `assignment.source_url` to decrypted `calendar.feed_url`
  - Set `assignment.source_id = calendar.id`
- [ ] Migration runs successfully on:
  - Clean database (no existing data)
  - Database with existing assignments + `settings.icalUrl`
  - Database with existing assignments but no `settings.icalUrl`
- [ ] Unit test for migration runner using real sql.js WASM

## Technical Details

### Migration SQL (006_calendars.sql)
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

-- Add source_id to assignments
ALTER TABLE assignments ADD COLUMN source_id TEXT REFERENCES calendars(id);

-- Index for per-source dedupe
CREATE INDEX idx_assignments_source_ical ON assignments(source_id, ical_uid);
```

### Migration Runner (src/backend/main/db/migrate.ts)
- After running SQL statements, execute seeding/backfill in JavaScript (not SQL) because:
  - Need to decrypt `settings.icalUrl` (requires crypto module)
  - Need to re-encrypt for `calendars.feed_url`
  - Need to match URLs for backfill
- Use existing `getDatabase()`, `encryptSetting()`, `decryptSetting()`
- Generate UUIDs for new calendar rows (use `crypto.randomUUID()`)

### Seeding Logic
```typescript
async function seedCalendarFromSettings(db: Database) {
  // Check if calendars table is empty
  const count = db.exec("SELECT COUNT(*) as cnt FROM calendars")[0]?.values[0][0] as number;
  if (count > 0) return; // Already seeded

  // Get encrypted icalUrl from settings
  const settingsRow = db.exec("SELECT value FROM settings WHERE key = 'icalUrl'")[0];
  if (!settingsRow?.values[0]?.[0]) return; // No icalUrl configured

  const encrypted = settingsRow.values[0][0] as string;
  const decrypted = await decryptSetting(encrypted); // Returns plaintext URL
  
  // Create calendar
  const calendarId = crypto.randomUUID();
  const now = Date.now();
  const color = hashToColor("Primary Calendar"); // Deterministic
  const encryptedFeedUrl = await encryptSetting(decrypted);
  
  db.run(
    `INSERT INTO calendars (id, name, feed_url, enabled, color, position, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, 0, ?, ?)`,
    [calendarId, "Primary Calendar", encryptedFeedUrl, color, now, now]
  );

  // Backfill assignments
  db.run(
    `UPDATE assignments SET source_id = ? WHERE source = 'ical' AND source_url = ?`,
    [calendarId, decrypted]
  );
}
```

### Color Generation
```typescript
function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`; // Convert to hex if preferred
}
```

## Dependencies
- Requires: `phase4-00-data-model-update` (types defined)
- Requires: `src/backend/main/security/encryption.ts` (encrypt/decrypt functions)

## Testing
- Unit test: Clean DB → migration creates tables, no seeding
- Unit test: DB with `settings.icalUrl` → calendar seeded, assignments backfilled
- Unit test: DB with multiple `settings.icalUrl` (shouldn't happen but handle gracefully)
- Unit test: Migration idempotent — running twice doesn't duplicate/seed again
- Integration test: Full app startup with migrated DB → calendars accessible via IPC

## Related
- `phase4-00-data-model-update` — Types, IPC
- `phase4-01-calendars-schema` — Repository uses migrated schema
- `docs/architecture/multi-calendar.md` — Migration design