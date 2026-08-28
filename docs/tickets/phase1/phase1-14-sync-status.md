# Ticket: phase1-14-sync-status

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Show last sync time, next auto-sync countdown, manual "Sync Now" button with spinner.

---

## Requirements

### Functional

- [ ] **Display** (in TopBar, ticket 1.13):
  - Last sync: "Last synced 5 min ago" / "Last synced Jan 15, 2:30 PM" / "Never synced"
  - Next auto-sync: "Next sync in 45 min" (countdown, updates every minute)
  - Manual "Sync Now" button with spinner during sync
- [ ] **Data Source**:
  - `lastSyncAt` from `settings` (updated by `ical:import` handler)
  - `autoFetchIntervalMs` from `settings` (0 = disabled)
- [ ] **Sync Now Action**:
  - Calls `window.api.ical.fetch(url)` → `window.api.ical.import(events, url)` (same as Settings "Fetch Now")
  - Shows spinner during operation
  - Disabled while sync in progress
  - On success: toast "Synced: X new, Y updated"
  - On error: toast with error message
- [ ] **Countdown Timer**: Updates every minute; pauses when `autoFetchIntervalMs === 0`

### Non-Functional

- [ ] **Time Formatting**: Relative time for recent (< 1 hour), absolute for older
- [ ] **Performance**: Countdown timer uses single `setInterval` (cleanup on unmount)
- [ ] **Accessibility**: Button has `aria-busy` during sync, `aria-live` for status updates

---

## Designs & Constraints

- **Location**: `src/frontend/src/components/SyncStatusIndicator.tsx`
- **Hooks**:
  - `useSyncStatus()` — returns `{ lastSyncAt, nextSyncAt, isSyncing, syncNow }`
  - `useSettings()` — for `autoFetchIntervalMs`, `icalUrl`
- **IPC**:
  - `settings:get` — for `lastSyncAt`, `autoFetchIntervalMs`
  - `ical:fetch` + `ical:import` — for manual sync
  - `ical:progress` — for progress feedback (optional, spinner sufficient for MVP)

### Component Structure

```tsx
// SyncStatusIndicator.tsx
<div className={styles.container}>
  <span className={styles.lastSync}>
    {lastSyncAt ? formatRelative(lastSyncAt) : 'Never synced'}
  </span>
  {autoFetchIntervalMs > 0 && (
    <span className={styles.nextSync}>Next sync in {formatCountdown(nextSyncAt)}</span>
  )}
  <button
    className={styles.syncBtn}
    onClick={handleSyncNow}
    disabled={isSyncing}
    aria-busy={isSyncing}
  >
    {isSyncing ? <Spinner /> : 'Sync Now'}
  </button>
</div>
```

---

## Code Changes

### New Files

- `src/frontend/src/components/SyncStatusIndicator.tsx`
- `src/frontend/src/hooks/useSyncStatus.ts`
- `src/frontend/src/__tests__/SyncStatusIndicator.test.tsx`

### Modified Files

- `src/frontend/src/components/TopBar.tsx` — integrate SyncStatusIndicator
- `src/backend/main/ipc-handlers.ts` — ensure `settings.lastSyncAt` updated on `ical:import` success

---

## Acceptance Criteria

| #   | Criterion                                   | Verification                                |
| --- | ------------------------------------------- | ------------------------------------------- |
| 1   | Shows "Never synced" when `lastSyncAt` null | Test with fresh settings                    |
| 2   | Shows relative time for recent sync         | Test with `lastSyncAt = Date.now() - 5min`  |
| 3   | Shows absolute time for older sync          | Test with `lastSyncAt = Date.now() - 2days` |
| 4   | Countdown updates every minute              | Wait/test timer                             |
| 5   | Countdown hidden when auto-fetch disabled   | Test `autoFetchIntervalMs = 0`              |
| 6   | "Sync Now" triggers fetch → import flow     | Mock IPC, verify calls                      |
| 7   | Spinner + disabled during sync              | Visual test                                 |
| 8   | Success toast with counts on completion     | Test import result                          |
| 9   | Error toast on failure                      | Mock IPC rejection                          |
| 10  | All tests pass (`pnpm test`)                | CI run                                      |

---

## Notes

- `lastSyncAt` updated in `ical:import` handler (ticket 1.5) on successful import
- Auto-fetch scheduler NOT implemented in Phase 1 (just UI countdown); Phase 2 adds background scheduler
- This component reads settings — ensure `settings:get` called on mount and after sync

---

## Release Summary

Add sync status indicator: last sync time, next sync countdown, manual Sync Now button
