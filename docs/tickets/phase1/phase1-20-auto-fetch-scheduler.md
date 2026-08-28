# Ticket: phase1-20-auto-fetch-scheduler

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Medium (Deferred to Phase 2)  
**Estimated Effort:** 0.5 day

---

## Description

Implement background auto-fetch scheduler that periodically fetches and imports iCal data based on `settings.autoFetchIcal` and `settings.icalFetchIntervalMinutes`.

---

## Decision: DEFERRED TO PHASE 2

**This ticket is explicitly deferred to Phase 2.** Phase 1 MVP includes:

- Manual "Sync Now" button (Ticket 1.14)
- Sync status UI with countdown timer (Ticket 1.14)
- Auto-fetch settings persisted in `Settings` (Ticket 1.8)

The **scheduler implementation** (background `setInterval` in main process) is Phase 2 work.

---

## Phase 1 Scope (What IS Done)

- [x] `Settings` has `autoFetchIcal` and `icalFetchIntervalMinutes` (Ticket 1.0 + 1.8)
- [x] Sync status UI shows countdown based on these settings (Ticket 1.14)
- [x] Manual "Sync Now" triggers fetch → import (Ticket 1.14)
- [x] `lastSyncAt` updated on successful import (Ticket 1.5)

---

## Phase 2 Scope (Future Work)

When implementing in Phase 2:

### Functional

- [ ] **Scheduler in Main Process**: `setInterval` in `src/backend/main/index.ts` or dedicated module
- [ ] **Respect Settings**: Only runs if `autoFetchIcal === true` and `icalFetchIntervalMinutes > 0`
- [ ] **Use `icalUrl` from Settings**: Fetch user's configured URL
- [ ] **Reuse Existing Logic**: Call same `ical:fetch` → `ical:import` flow as manual sync
- [ ] **Handle Errors Gracefully**: Log errors, don't crash; update `lastSyncAt` only on success
- [ ] **Dynamic Interval**: Respond to settings changes (restart timer on `settings:changed`)

### Non-Functional

- [ ] **Single Instance**: Only one scheduler running (handle app restart, settings change)
- [ ] **No Overlap**: Prevent concurrent fetch/import (use mutex/flag)
- [ ] **Cleanup**: Clear interval on app quit

---

## Designs & Constraints

- **Location**: `src/backend/main/scheduler.ts` (new) or `src/backend/main/index.ts`
- **Settings Access**: Read from repository or cache in memory
- **IPC**: Reuse `ical:fetch` and `ical:import` handlers (or call repository directly)

### Scheduler Sketch (Phase 2)

```typescript
// src/backend/main/scheduler.ts
import { fetchAndImportIcal } from './ical-service'; // extract from handlers
import { getSettings } from './db/repository';

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

export function startScheduler() {
  stopScheduler(); // Ensure single instance

  const settings = getSettings();
  if (!settings.autoFetchIcal || settings.icalFetchIntervalMinutes <= 0) {
    return;
  }

  const intervalMs = settings.icalFetchIntervalMinutes * 60 * 1000;

  intervalId = setInterval(async () => {
    if (isRunning) return; // Prevent overlap
    isRunning = true;

    try {
      await fetchAndImportIcal(settings.icalUrl);
    } catch (error) {
      console.error('Auto-fetch failed:', error);
    } finally {
      isRunning = false;
    }
  }, intervalMs);
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Listen for settings changes
ipcMain.on('settings:changed', () => {
  startScheduler(); // Restart with new settings
});
```

---

## Acceptance Criteria (Phase 2)

| #   | Criterion                                  | Verification                   |
| --- | ------------------------------------------ | ------------------------------ |
| 1   | Scheduler starts on app launch if enabled  | Check logs                     |
| 2   | Scheduler respects `autoFetchIcal` = false | Disable, verify no fetch       |
| 3   | Scheduler respects interval setting        | Change interval, verify timing |
| 4   | Fetch/import runs on schedule              | Wait, verify DB updates        |
| 5   | `lastSyncAt` updated on success            | Check settings                 |
| 6   | Errors logged, scheduler continues         | Simulate network error         |
| 7   | Settings change restarts scheduler         | Update settings, verify        |
| 8   | No overlapping runs                        | Short interval, verify mutex   |

---

## Notes

- **Phase 1 does NOT implement this** — only the UI and settings foundation
- The countdown timer in Ticket 1.14 is purely **UI** (client-side `setInterval`)
- Phase 2 will implement the actual background scheduler in main process
- This ticket exists as a **placeholder** for Phase 2 planning

---

## Release Summary

[DEFERRED] Auto-fetch scheduler — Phase 2 implementation
