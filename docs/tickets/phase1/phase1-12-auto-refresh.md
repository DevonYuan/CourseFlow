# Ticket: phase1-12-auto-refresh

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Subscribe to `window.api.onDbChanged` → re-fetch list when `assignments` table changes.

---

## Requirements

### Functional

- [ ] **Subscription**: In `useAssignments` hook, subscribe to `onDbChanged` on mount
- [ ] **Filter**: Only re-fetch when `payload.table === 'assignments'`
- [ ] **Actions**: Handle `insert`, `update`, `delete` — all trigger re-fetch
- [ ] **Cleanup**: Unsubscribe on unmount
- [ ] **Dedupe**: Debounce rapid events (e.g., batch import emits many `insert`) — 100ms

### Non-Functional

- [ ] **Performance**: Don't re-fetch on unrelated table changes (`sub_tasks`, `notes`, etc.)
- [ ] **Reliability**: Handle missed events gracefully (periodic fallback sync optional)
- [ ] **Memory**: No memory leaks — cleanup verified

---

## Designs & Constraints

- **Location**: `src/frontend/src/hooks/useAssignments.ts`
- **Preload API** (to be exposed in `src/backend/preload/index.ts`):
  ```typescript
  onDbChanged: (callback: (payload: DbChangedEvent) => void) => () => void;
  ```
- **Event Payload** (from IPC contract):
  ```typescript
  interface DbChangedEvent {
    table: string;
    action: 'insert' | 'update' | 'delete';
    id: string;
  }
  ```

### Implementation

```typescript
// In useAssignments hook
useEffect(() => {
  const unsubscribe = window.api.onDbChanged((event) => {
    if (event.table === 'assignments') {
      // Debounce
      debouncedRefetch();
    }
  });
  return unsubscribe;
}, []);

const debouncedRefetch = useMemo(() => debounce(() => fetchAssignments(), 100), [fetchAssignments]);
```

---

## Code Changes

### Modified Files

- `src/frontend/src/hooks/useAssignments.ts` — add subscription logic
- `src/backend/preload/index.ts` — expose `onDbChanged`
- `src/backend/main/ipc-handlers.ts` — ensure `db:changed` emitted on assignment CRUD (already in repo)

### New Files

- `src/frontend/src/utils/debounce.ts` — simple debounce utility (or use lodash-es)

---

## Acceptance Criteria

| #   | Criterion                                  | Verification                              |
| --- | ------------------------------------------ | ----------------------------------------- |
| 1   | Subscribes to `onDbChanged` on mount       | Test hook mount                           |
| 2   | Re-fetches on `assignments` table `insert` | Emit test event, verify fetch called      |
| 3   | Re-fetches on `assignments` table `update` | Emit test event, verify fetch called      |
| 4   | Re-fetches on `assignments` table `delete` | Emit test event, verify fetch called      |
| 5   | Ignores other table changes                | Emit `sub_tasks` event, verify no fetch   |
| 6   | Debounces rapid events (100ms)             | Emit 5 events in 50ms, verify 1 fetch     |
| 7   | Unsubscribes on unmount                    | Test unmount, verify no further callbacks |
| 8   | All tests pass (`pnpm test`)               | CI run                                    |

---

## Notes

- This enables real-time UI updates when:
  - iCal import adds/updates assignments (ticket 1.5)
  - User marks complete (ticket 1.11)
  - Future: drag-drop reorder (Phase 2)
- Debounce prevents excessive fetches during batch import (which emits many `insert` events)

---

## Release Summary

Add auto-refresh via db:changed event subscription with debouncing
