# Ticket: phase4-05-import-per-source

## Title
**Per-Source Import & Dedupe**

## Description
Refactor `importAssignments` to accept `sourceId` and scope dedupe/prune to that source only. Update `ical:import` IPC to take `sourceId`. Scheduler iterates enabled sources sequentially.

## Acceptance Criteria
- [ ] `importAssignments(assignments: AssignmentInput[], options: { sourceId: string })` signature updated
- [ ] Dedupe key changes from global `ical_uid` to `(source_id, ical_uid)` composite
- [ ] Prune step only deletes assignments where `source_id = sourceId` AND `ical_uid` not in batch
- [ ] `ical:import` IPC handler updated to accept `{ events, sourceUrl, sourceId }`
- [ ] `ical:import` returns `ImportResult` per source
- [ ] Protected fields (sub-tasks, notes, priority_order, user-set status) still preserved per source
- [ ] Unit tests for per-source import with multiple calendars

## Technical Details

### Current `importAssignments` (simplified)
```typescript
// Current: global dedupe by ical_uid
async function importAssignments(assignments: AssignmentInput[]): Promise<ImportResult> {
  const uids = new Set(assignments.map(a => a.ical_uid));
  // Upsert by ical_uid
  // Prune: DELETE FROM assignments WHERE source='ical' AND ical_uid NOT IN (uids)
}
```

### New `importAssignments` (per-source)
```typescript
async function importAssignments(
  assignments: AssignmentInput[],
  options: { sourceId: string; sourceUrl: string }
): Promise<ImportResult> {
  const { sourceId, sourceUrl } = options;
  const uids = new Set(assignments.map(a => a.ical_uid));
  
  // 1. Upsert each assignment with source_id
  for (const a of assignments) {
    await db.run(
      `INSERT INTO assignments (..., source_id, source_url, ical_uid, ...)
       VALUES (..., ?, ?, ?, ...)
       ON CONFLICT(source_id, ical_uid) DO UPDATE SET
         title=excluded.title, due_at=excluded.due_at, ...,
         updated_at=excluded.updated_at
       WHERE status IN ('pending', 'in_progress')`, // Preserve completed/archived
      [sourceId, sourceUrl, a.ical_uid, ...]
    );
  }
  
  // 2. Prune ONLY this source's stale assignments
  // Preserve: status IN ('completed', 'archived') OR source = 'manual'
  const placeholders = uids.size > 0 ? Array.from(uids).map(() => '?').join(',') : 'NULL';
  await db.run(
    `DELETE FROM assignments 
     WHERE source_id = ? 
       AND source = 'ical'
       AND status NOT IN ('completed', 'archived')
       AND ical_uid NOT IN (${placeholders})`,
    [sourceId, ...Array.from(uids)]
  );
  
  return { imported: ..., updated: ..., skipped: ... };
}
```

### Schema Change Required (from migration v6)
- Unique constraint/index on `(source_id, ical_uid)` instead of global `ical_uid`
- Migration v6 adds `CREATE INDEX idx_assignments_source_ical ON assignments(source_id, ical_uid)`

### IPC Handler Update
```typescript
ipcMain.handle('ical:import', async (_event, payload: { 
  events: ICalEvent[]; 
  sourceUrl: string; 
  sourceId: string;  // NEW
}): Promise<IpcResult<ImportResult>> => {
  const assignments = mapICalToAssignments(payload.events, payload.sourceUrl, payload.sourceId);
  const result = await repo.importAssignments(assignments, { 
    sourceId: payload.sourceId, 
    sourceUrl: payload.sourceUrl 
  });
  return { ok: true, data: result };
});
```

### Mapper Update
```typescript
function mapICalToAssignments(events: ICalEvent[], sourceUrl: string, sourceId: string): AssignmentInput[] {
  return events.map(e => ({
    ...,
    source: 'ical',
    source_url: sourceUrl,
    source_id: sourceId,  // NEW
    ical_uid: e.uid,      // Per-occurrence UID for recurring
  }));
}
```

## Dependencies
- Requires: `phase4-04-migration-v6` (schema with source_id + composite index)
- Requires: `phase4-01-calendars-schema` (repository method signature)

## Testing
- Unit test: Import source A → only source A assignments affected
- Unit test: Import source A then source B → both preserved, no cross-pruning
- Unit test: Re-import source A with updated event → updates existing (by source_id + ical_uid)
- Unit test: Completed assignments from source A preserved during re-import
- Unit test: Manual assignments (source='manual') never pruned

## Related
- `phase4-04-migration-v6` — Schema
- `phase4-06-scheduler-multi` — Scheduler calls per-source import
- `docs/architecture/multi-calendar.md` — Import/export semantics