---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-15-scheduler-integration

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 1 day

---

## Description

Wire scheduler to existing `ical:fetch` → `ical:import` pipeline. Handle errors gracefully: network failures → retry with backoff (max 3); 401/403 → toast "iCal URL invalid, check Settings"; don't crash scheduler. Coalesce manual + background sync.

---

## Requirements

### Functional

- [ ] Scheduler `tick` calls internal `fetchAndImport()` method:
  - Fetch iCal URL from settings (decrypted)
  - Call `ical:fetch` logic (reuse from ticket 1.1)
  - Call `ical:import` logic (reuse from ticket 1.4)
  - On success: emit `scheduler:tick` with nextRun, update `lastRun`
  - On error: emit `scheduler:error`, schedule retry
- [ ] Retry logic: exponential backoff (1min, 2min, 4min) max 3 retries
- [ ] Error classification:
  - Network/timeout → retry
  - 401/403 → **no retry**, emit error "iCal URL invalid or expired — check Settings", pause scheduler until URL updated
  - 404/5xx → retry
  - Parse error → **no retry**, emit error "Failed to parse iCal feed", pause scheduler
- [ ] Coalescing: if `triggerManual()` called while background fetch running:
  - Option A: Queue manual after background completes
  - Option B: Ignore manual, show toast "Sync in progress..."
  - **Decision: Option B** — simpler, prevents duplicate work
- [ ] `ical:progress` events emitted during background fetch (reuse Phase 1 events)
- [ ] Update `settings.sync_interval_minutes` at runtime restarts scheduler

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Scheduler never crashes — all errors caught and emitted
- [ ] No duplicate imports: `ical:import` deduplication (ticket 1.4) handles re-imports
- [ ] Priority/notes/subtasks preserved on background re-import (ticket 2.4)
- [ ] Logging: structured logs for each tick (start, success, error, retry)

---

## Designs & Constraints

- **Location**: `src/backend/main/scheduler.ts` — `fetchAndImport()` private method
- **Reuse**: Import `fetchICalFeed` from `src/backend/main/ical/fetch.ts`, `importICalEvents` from `src/backend/main/ical/import.ts`
- **Settings access**: `SettingsRepository.get('ical_url')` (decrypted), `get('sync_interval_minutes')`
- **Decryption**: Use existing encryption module (Phase 1 ticket 1.7)
- **Retry state**: Track `retryCount` per tick, reset on success

### Error Handling Flow

```
Tick
  │
  ▼
Fetch iCal URL (decrypt)
  │
  ▼
ical:fetch(url)
  │
  ├── Success → ical:import(events)
  │               │
  │               ├── Success → emit tick, update lastRun, reset retryCount
  │               │
  │               └── Error → classify → retry or pause
  │
  └── Error → classify → retry or pause
```

### Error Codes

| Code      | Cause                            | Retry?   | UI Message                                     |
| --------- | -------------------------------- | -------- | ---------------------------------------------- |
| `network` | Timeout, DNS, connection refused | Yes (3x) | "Network error — retrying..."                  |
| `auth`    | 401, 403                         | **No**   | "iCal URL invalid or expired — check Settings" |
| `parse`   | Invalid iCal format              | **No**   | "Failed to parse calendar feed"                |
| `server`  | 5xx                              | Yes (3x) | "Server error — retrying..."                   |
| `unknown` | Other                            | Yes (3x) | "Sync failed — retrying..."                    |

---

## Code Changes

### New Files

- None

### Modified Files

- `src/backend/main/scheduler.ts` — implement `fetchAndImport()` with error handling + retry
- `src/backend/main/ipc-handlers.ts` — ensure `settings:set` triggers scheduler restart
- `src/backend/main/ical/fetch.ts` — export error classes for classification
- `src/backend/main/ical/import.ts` — ensure deduplication works for background imports

---

## Acceptance Criteria

| #   | Criterion                                                     | Verification                |
| --- | ------------------------------------------------------------- | --------------------------- |
| 1   | Background sync runs at interval, imports assignments         | Manual test (interval=1min) |
| 2   | Network error → retries 3x with backoff                       | Unit test (mock fetch fail) |
| 3   | 401/403 → pauses scheduler, shows error toast                 | Manual test (bad URL)       |
| 4   | Parse error → pauses scheduler, shows error toast             | Manual test (bad .ics)      |
| 5   | Manual "Sync Now" during background sync → ignored with toast | Manual test                 |
| 6   | Interval change at runtime → scheduler restarts               | Manual test                 |
| 7   | `ical:progress` events emitted during background fetch        | Event test                  |
| 8   | Priority/notes preserved on background re-import              | Integration test            |
| 9   | All tests pass (`pnpm test`)                                  | CI run                      |

---

## Notes

- "Pause scheduler" = stop interval, set `running: false`, require user action (update URL) to resume
- Retry backoff: `setTimeout` not `setInterval` — each retry schedules next
- Max 3 retries per tick — after 3 failures, pause and emit error
- Toast shown via `scheduler:error` event → frontend toast system (Phase 1 ticket 1.15)
- Consider: if app offline at tick time, retry immediately on `online` event (deferred)
- Scheduler logs should include `assignmentCount` imported for debugging

---

## Release Summary

Wire scheduler to iCal fetch/import pipeline with retry, error classification, and manual/background coalescing
