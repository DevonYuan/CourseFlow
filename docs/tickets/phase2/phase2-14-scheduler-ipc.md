---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-14-scheduler-ipc

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Add IPC handlers and events for scheduler control: `scheduler:start`, `scheduler:stop`, `scheduler:status`, `scheduler:trigger`. Expose via preload bridge. Emit `scheduler:tick` and `scheduler:error` events for UI.

---

## Requirements

### Functional

- [ ] `ipcMain.handle('scheduler:start', ...)` → calls `scheduler.start(interval)`, returns `SchedulerStatus`
- [ ] `ipcMain.handle('scheduler:stop', ...)` → calls `scheduler.stop()`, returns `SchedulerStatus`
- [ ] `ipcMain.handle('scheduler:status', ...)` → returns `SchedulerStatus`
- [ ] `ipcMain.handle('scheduler:trigger', ...)` → calls `scheduler.triggerManual()`, returns `void`
- [ ] `ipcMain.on('settings:changed', ...)` — when `sync_interval_minutes` changes, restart scheduler
- [ ] Emit `scheduler:tick` event: `{ nextRun: string }` (ISO timestamp)
- [ ] Emit `scheduler:error` event: `{ message: string, code: string }`
- [ ] Input validation: `start` requires `intervalMinutes > 0`

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Handlers registered in `initializeIpcHandlers()`
- [ ] Events emitted via `mainWindow.webContents.send()`
- [ ] Typed end-to-end via `src/backend/shared/ipc.ts` (ticket 2.0)

---

## Designs & Constraints

- **Channel names** (from ticket 2.0):
  - `scheduler:start` — Request: `{ intervalMinutes: number }`, Response: `SchedulerStatus`
  - `scheduler:stop` — Request: `void`, Response: `SchedulerStatus`
  - `scheduler:status` — Request: `void`, Response: `SchedulerStatus`
  - `scheduler:trigger` — Request: `void`, Response: `void`
- **Events** (Main → Renderer):
  - `scheduler:tick` — Payload: `{ nextRun: string }`
  - `scheduler:error` — Payload: `{ message: string; code: 'network' | 'auth' | 'parse' | 'unknown' }`
- **Settings integration**: `settings:changed` event (already exists) → check `sync_interval_minutes` diff

### Preload Bridge (ticket 2.16)

```typescript
scheduler: {
  start: (intervalMinutes: number) => ipcRenderer.invoke('scheduler:start', { intervalMinutes }),
  stop: () => ipcRenderer.invoke('scheduler:stop'),
  status: () => ipcRenderer.invoke('scheduler:status'),
  trigger: () => ipcRenderer.invoke('scheduler:trigger'),
  onTick: (cb) => ipcRenderer.on('scheduler:tick', (_e, payload) => cb(payload)),
  onError: (cb) => ipcRenderer.on('scheduler:error', (_e, payload) => cb(payload)),
}
```

---

## Code Changes

### New Files

- None

### Modified Files

- `src/backend/main/ipc-handlers.ts` — add 4 handler registrations + settings change listener
- `src/backend/main/events.ts` — add `emitSchedulerTick`, `emitSchedulerError`
- `src/backend/shared/ipc.ts` — already updated in ticket 2.0

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `scheduler:start` starts scheduler, returns status | IPC test |
| 2 | `scheduler:stop` stops scheduler, returns status | IPC test |
| 3 | `scheduler:status` returns current status | IPC test |
| 4 | `scheduler:trigger` runs immediate fetch/import | IPC test |
| 5 | `settings:changed` with new interval restarts scheduler | Integration test |
| 6 | `scheduler:tick` emitted on each interval | Event test |
| 7 | `scheduler:error` emitted on fetch/import failure | Event test (mock error) |
| 8 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- `scheduler:trigger` used by "Sync Now" button in UI
- UI countdown timer uses `scheduler:tick` `nextRun` to show "Next sync in X min"
- Error codes help UI show specific messages: "Network error", "Invalid iCal URL", etc.
- Scheduler status includes `lastRun` for "Last synced" display
- No authentication needed for scheduler IPC — internal only

---

## Release Summary

Add IPC handlers for scheduler control and events for UI countdown/error display