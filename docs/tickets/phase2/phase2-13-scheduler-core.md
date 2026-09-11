---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-13-scheduler-core

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 1 day

---

## Description

Implement `src/backend/main/scheduler.ts`: `setInterval`-based background scheduler in Main process. Configurable interval via `settings.sync_interval_minutes` (default: 15). Start/stop on app ready/quit. Handle sleep/wake with `power-monitor`.

---

## Requirements

### Functional

- [ ] `Scheduler` class in `src/backend/main/scheduler.ts`:
  - `start(intervalMinutes: number): void` — begin periodic fetch
  - `stop(): void` — clear interval
  - `getStatus(): SchedulerStatus` — `{ running: boolean; intervalMinutes: number; lastRun: string | null; nextRun: string | null }`
  - `triggerManual(): Promise<void>` — immediate fetch (for "Sync Now" button)
- [ ] Interval: `setInterval` with `intervalMinutes * 60 * 1000` ms
- [ ] First run: wait 30 seconds after `start()` to avoid startup contention
- [ ] On each tick: call `ical:fetch` → `ical:import` pipeline (existing IPC handlers)
- [ ] Read interval from `settings.sync_interval_minutes` (default 15)
- [ ] `power-monitor` integration: on `suspend`, pause; on `resume`, resync next run time
- [ ] Emit `scheduler:tick` event with `nextRun` for UI countdown
- [ ] Emit `scheduler:error` on failures (non-fatal)

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Single interval timer — no overlapping runs (guard with `isRunning` flag)
- [ ] Errors don't crash scheduler — log and continue
- [ ] Clean shutdown: `stop()` called on `app.on('will-quit')`
- [ ] Configurable via settings — interval change restarts timer
- [ ] Testable: `triggerManual()` exposed for E2E tests

---

## Designs & Constraints

- **Location**: `src/backend/main/scheduler.ts`
- **Dependencies**: `electron` (`power-monitor`, `ipcMain`), existing `ical:fetch`/`ical:import` handlers
- **Interval storage**: `settings` table key `sync_interval_minutes` (encrypted? No, not sensitive)
- **Event emission**: Use `mainWindow.webContents.send('scheduler:tick', { nextRun })` and `scheduler:error`
- **Main window reference**: Passed to scheduler constructor or via module-level getter

### SchedulerStatus Type

```typescript
interface SchedulerStatus {
  running: boolean;
  intervalMinutes: number;
  lastRun: string | null; // ISO timestamp
  nextRun: string | null; // ISO timestamp
}
```

### Lifecycle

```
App Ready
    │
    ▼
Read settings.sync_interval_minutes
    │
    ▼
If > 0 and ical_url configured → scheduler.start(interval)
    │
    ▼
[30s delay] → First tick → ical:fetch → ical:import → emit scheduler:tick
    │
    ▼
Repeat every intervalMinutes
    │
    ▼
App Quit → scheduler.stop()
```

---

## Code Changes

### New Files

- `src/backend/main/scheduler.ts` — Scheduler class

### Modified Files

- `src/backend/main/index.ts` — initialize scheduler on app ready, stop on will-quit
- `src/backend/main/ipc-handlers.ts` — add `scheduler:start`, `scheduler:stop`, `scheduler:status` handlers (ticket 2.14)
- `src/backend/main/events.ts` — add `emitSchedulerTick`, `emitSchedulerError` helpers

---

## Acceptance Criteria

| #   | Criterion                                                   | Verification                 |
| --- | ----------------------------------------------------------- | ---------------------------- |
| 1   | Scheduler starts automatically on app ready (if configured) | Manual test                  |
| 2   | Interval respects `sync_interval_minutes` setting           | Manual test (set to 1 min)   |
| 3   | First run delayed 30s                                       | Manual test (log timestamps) |
| 4   | Each tick calls fetch → import pipeline                     | IPC spy / logs               |
| 5   | `scheduler:tick` event emitted with nextRun                 | Event listener test          |
| 6   | Sleep/wake resyncs next run                                 | Manual test (sleep Mac)      |
| 7   | Stop on quit, no memory leaks                               | Manual test                  |
| 8   | All tests pass (`pnpm test`)                                | CI run                       |

---

## Notes

- `power-monitor` events: `suspend` (system sleep), `resume` (wake), `on-ac`/`on-battery` (power source)
- On `resume`: calculate time until next scheduled run, set new timeout (not interval) to align
- If `sync_interval_minutes` changed at runtime: `stop()` → `start(newInterval)`
- "Sync Now" button (UI) calls `triggerManual()` — should not interfere with interval timer
- Consider: if manual sync in progress, skip scheduled tick (coalesce) — or let both run (idempotent import)
- Scheduler runs in Main process — no React/contextBridge needed

---

## Release Summary

Implement background auto-fetch scheduler with configurable interval, sleep/wake handling, and tick events
