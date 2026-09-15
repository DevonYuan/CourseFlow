# Ticket: phase4-06-scheduler-multi

## Title
**Multi-Source Scheduler**

## Description
Update `src/backend/main/scheduler.ts` to loop over enabled `CalendarSource`s. Per-source retry/backoff (max 3). Per-source `last_sync_at`, `next_sync_at`, `last_error`. Emit `ical:progress` with `sourceId` in payload. Coalesce manual "Sync Now" per-source.

## Acceptance Criteria
- [ ] Scheduler fetches all enabled calendars sequentially (not parallel)
- [ ] Per-source timeout: 30 seconds max per feed
- [ ] Per-source retry: exponential backoff (1s, 2s, 4s) max 3 attempts
- [ ] On success: update `last_sync_at`, `next_sync_at`, clear `last_error`
- [ ] On failure: update `last_error` with classified error code, schedule `next_sync_at`
- [ ] `ical:progress` events include `sourceId` and `sourceName` in payload
- [ ] Manual "Sync Now" (`scheduler:trigger`) runs all enabled sources sequentially
- [ ] Coalescing: If manual sync triggered while background sync running, ignore/queue per source
- [ ] Scheduler start/stop respects `settings.syncIntervalMinutes` (0 = disabled)
- [ ] Unit tests for scheduler logic (mock fetch/import)

## Technical Details

### Scheduler Loop
```typescript
async function runSyncCycle(): Promise<void> {
  const calendars = await repo.listCalendars();
  const enabled = calendars.filter(c => c.enabled);
  
  for (const cal of enabled) {
    if (isSyncing[cal.id]) continue; // Coalesce
    isSyncing[cal.id] = true;
    
    try {
      await syncSingleSource(cal);
      await repo.updateCalendar(cal.id, { 
        last_sync_at: Date.now(),
        next_sync_at: Date.now() + intervalMs,
        last_error: null,
        updated_at: Date.now()
      });
      sendEventToRenderers('db:changed', { table: 'calendars', action: 'update', id: cal.id });
    } catch (err) {
      await handleSyncError(cal, err);
    } finally {
      isSyncing[cal.id] = false;
    }
  }
}

async function syncSingleSource(cal: CalendarSource): Promise<void> {
  const feedUrl = await decryptSetting(cal.feed_url);
  
  // Emit progress: fetching
  sendEventToRenderers('ical:progress', { 
    stage: 'fetching', 
    progress: 10, 
    sourceId: cal.id, 
    sourceName: cal.name 
  });
  
  const icalText = await fetchWithRetry(feedUrl, { timeout: 30000, maxRetries: 3 });
  
  // Emit progress: parsing
  sendEventToRenderers('ical:progress', { 
    stage: 'parsing', 
    progress: 50, 
    sourceId: cal.id, 
    sourceName: cal.name 
  });
  
  const events = parseICalFeed(icalText);
  
  // Emit progress: importing
  sendEventToRenderers('ical:progress', { 
    stage: 'importing', 
    progress: 80, 
    sourceId: cal.id, 
    sourceName: cal.name 
  });
  
  await repo.importAssignments(
    mapICalToAssignments(events, feedUrl, cal.id),
    { sourceId: cal.id, sourceUrl: feedUrl }
  );
  
  // Emit progress: complete
  sendEventToRenderers('ical:progress', { 
    stage: 'complete', 
    progress: 100, 
    sourceId: cal.id, 
    sourceName: cal.name 
  });
}
```

### Error Classification
```typescript
function classifyError(err: Error): { code: string; message: string } {
  if (err.name === 'TimeoutError') return { code: 'network', message: 'Request timed out' };
  if (err.name === 'FetchError') return { code: 'network', message: err.message };
  if (err.status === 401 || err.status === 403) return { code: 'auth', message: 'Invalid or unauthorized feed URL' };
  if (err.status >= 500) return { code: 'server', message: 'Calendar server error' };
  if (err.name === 'ParseError') return { code: 'parse', message: 'Failed to parse iCal feed' };
  return { code: 'unknown', message: err.message };
}
```

### Progress Event Payload (Extended)
```typescript
interface ICalProgressEvent {
  stage: 'fetching' | 'parsing' | 'importing' | 'complete' | 'error';
  progress: number; // 0-100
  sourceId: string;        // NEW
  sourceName: string;      // NEW
  message?: string;
  errorCode?: 'network' | 'auth' | 'parse' | 'server' | 'unknown'; // For error stage
}
```

### Manual Sync Coalescing
```typescript
// In scheduler:trigger handler
ipcMain.handle('scheduler:trigger', async () => {
  const runningSources = Object.keys(isSyncing).filter(k => isSyncing[k]);
  if (runningSources.length > 0) {
    sendEventToRenderers('scheduler:coalesced', { 
      message: `Sync already in progress for ${runningSources.length} calendar(s)` 
    });
    return { ok: true, data: { coalesced: true } };
  }
  await runSyncCycle();
  return { ok: true, data: { coalesced: false } };
});
```

## Dependencies
- Requires: `phase4-05-import-per-source` (per-source import)
- Requires: `phase4-01-calendars-schema` (calendar CRUD for status updates)

## Testing
- Unit test: Sync runs enabled calendars sequentially
- Unit test: Failed feed doesn't block other calendars
- Unit test: Retry/backoff works (mock fetch failures)
- Unit test: Progress events include sourceId/sourceName
- Unit test: Manual sync coalesced when background running
- Unit test: `last_sync_at`/`next_sync_at`/`last_error` updated correctly

## Related
- `phase4-05-import-per-source` — Per-source import
- `phase4-07-calendars-settings-ui` — UI shows per-source status
- `phase4-08-unified-list-ui` — TopBar shows per-source sync status
- `docs/architecture/multi-calendar.md` — Scheduler design