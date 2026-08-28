# Ticket: phase1-11-mark-complete

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Click checkbox/btn → `window.api.db.assignments.upsert({ ...status: 'completed' })` → optimistic UI update → toast confirmation.

---

## PREREQUISITE

**This ticket depends on Ticket 1.0 (Data Model Alignment) being completed first.**

The current `AssignmentStatus` type in `src/backend/shared/types.ts` only has:

```typescript
type AssignmentStatus = 'pending' | 'completed';
```

Ticket 1.0 will add the full enum with `'in_progress'` and update the database schema. This ticket should use the expanded status values once available.

---

## Requirements

### Functional

- [ ] **Interaction**: Checkbox or "Mark Complete" button on each `AssignmentRow`
- [ ] **Optimistic Update**: Immediately update local Zustand store to `status: 'completed'` before IPC call
- [ ] **IPC Call**: `window.api.db.assignments.upsert({ id, status: 'completed', updatedAt: new Date().toISOString() })`
  - Note: `updatedAt` must be ISO 8601 string (matching `AssignmentInput` in shared/types.ts), not `Date.now()`
- [ ] **Success**: Show toast "Marked complete" (via toast system, ticket 1.15)
- [ ] **Failure**: Revert optimistic update, show error toast "Failed to update. Try again."
- [ ] **Completed Filter**: Completed assignments hidden from default list (ticket 1.9); "Show Completed" toggle (ticket 1.13/1.14) reveals them with strikethrough style

### Non-Functional

- [ ] **Latency**: Optimistic update < 50ms perceived
- [ ] **Idempotent**: Multiple clicks don't cause duplicate calls (disable button during request)
- [ ] **Accessibility**: Checkbox has proper label, keyboard operable (Space/Enter)

---

## Designs & Constraints

- **Location**:
  - `src/frontend/src/components/AssignmentRow.tsx` — checkbox/button UI
  - `src/frontend/src/hooks/useAssignments.ts` — `markComplete(id)` function
  - `src/frontend/src/store/assignmentsStore.ts` — optimistic update logic
- **IPC Channel** (from contract in `src/backend/shared/ipc.ts`):
  - `assignments:upsert` — request: `AssignmentInput`, response: `IpcResult<Assignment>`
- **Preload API** (already implemented in `src/backend/preload/index.ts`):
  ```typescript
  db: {
    assignments: {
      upsert: (input: AssignmentInput) => Promise<Assignment>;
    }
  }
  ```

### Optimistic Update Pattern

```typescript
// In useAssignments hook
const markComplete = async (id: string) => {
  // 1. Optimistic update
  const previous = assignmentsStore.getState().assignments;
  assignmentsStore.getState().setAssignmentStatus(id, 'completed');

  try {
    // 2. IPC call
    await window.api.db.assignments.upsert({
      id,
      status: 'completed',
      updatedAt: new Date().toISOString(), // ISO 8601 string, not Date.now()
    });
    // 3. Success toast
    toast.success('Marked complete');
  } catch (error) {
    // 4. Rollback on failure
    assignmentsStore.getState().setAssignments(previous);
    toast.error('Failed to update. Try again.');
  }
};
```

---

## Code Changes

### Modified Files

- `src/frontend/src/components/AssignmentRow.tsx` — add checkbox/button, wire `onClick`
- `src/frontend/src/hooks/useAssignments.ts` — add `markComplete` function
- `src/frontend/src/store/assignmentsStore.ts` — add `setAssignmentStatus` action
- `src/backend/preload/index.ts` — already exposes `db.assignments.upsert` (verify)

### New Files

- `src/frontend/src/__tests__/markComplete.test.tsx` — interaction tests

---

## Acceptance Criteria

| #   | Criterion                                     | Verification                         |
| --- | --------------------------------------------- | ------------------------------------ |
| 1   | Checkbox click triggers optimistic update     | Test: UI updates before IPC resolves |
| 2   | IPC `upsert` called with correct payload      | Mock IPC, verify call args           |
| 3   | Success toast shown on success                | Visual test                          |
| 4   | Rollback + error toast on failure             | Mock IPC rejection, verify rollback  |
| 5   | Completed assignment hidden from default list | Test filter logic                    |
| 6   | "Show Completed" toggle reveals completed     | Test toggle state                    |
| 7   | Disabled during request (no double-submit)    | Rapid click test                     |
| 8   | Accessible (label, keyboard)                  | axe-core test                        |
| 9   | All tests pass (`pnpm test`)                  | CI run                               |

---

## Notes

- `status: 'completed'` is distinct from `'archived'` — completed hides from default list but keeps in DB
- `updatedAt` must be sent so deduplication logic (ticket 1.4) works correctly on re-import
- This is the primary user action in Phase 1 MVP

---

## Release Summary

Add mark-complete interaction with optimistic UI update and toast confirmation
