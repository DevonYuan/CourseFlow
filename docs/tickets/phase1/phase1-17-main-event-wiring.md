# Ticket: phase1-17-main-event-wiring

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.25 day

---

## Description

Ensure main process (`src/backend/main/ipc-handlers.ts`) emits `db:changed`, `ical:progress`, and `settings:changed` events correctly after all CRUD operations, so frontend auto-refresh (Ticket 1.12) and sync status (Ticket 1.14) work.

---

## PREREQUISITE

**This ticket depends on Ticket 1.0 (Data Model Alignment) being completed first.**

The event payloads and handler logic will be updated by Ticket 1.0.

---

## Requirements

### Functional

- [ ] **`db:changed` Event Emission**:
  - Emitted after **every** assignment mutation: `insert`, `update`, `delete`
  - Payload: `{ table: 'assignments', action: 'insert' | 'update' | 'delete', id: string }`
  - Also emitted for `settings` table changes: `{ table: 'settings', action: 'update', id: 'singleton' }`
  - Also emitted for `sub_tasks`, `notes` tables (future-proofing)

- [ ] **`ical:progress` Event Emission** (during iCal import):
  - Stages: `'fetching'` → `'parsing'` → `'importing'` → `'complete'` | `'error'`
  - Progress: 0-100 number
  - Message: optional human-readable string
  - Emitted from `ical:import` handler at each stage

- [ ] **`settings:changed` Event Emission**:
  - Emitted after successful `settings:upsert`
  - Payload: full updated `Settings` object

### Non-Functional

- [ ] **Reliability**: Events emitted **after** database transaction commits
- [ ] **Performance**: Non-blocking emission (fire-and-forget to all renderer processes)
- [ ] **Consistency**: Use shared `sendEventToRenderers` utility (already exists in `ipc-handlers.ts`)

---

## Designs & Constraints

- **Location**: `src/backend/main/ipc-handlers.ts`
- **Utility**: `sendEventToRenderers(channel, payload)` — already implemented in Phase 0
- **Event Definitions**: `IpcEvents` in `src/backend/shared/ipc.ts`

### Current `sendEventToRenderers` Usage (verify/update)

```typescript
// In ipc-handlers.ts
import { sendEventToRenderers } from './events';
import type { IpcEvents } from '../shared/ipc';

// After assignment upsert:
sendEventToRenderers('db:changed', { table: 'assignments', action: 'insert', id: newId });

// After assignment update:
sendEventToRenderers('db:changed', { table: 'assignments', action: 'update', id });

// After assignment delete:
sendEventToRenderers('db:changed', { table: 'assignments', action: 'delete', id });

// In ical:import handler:
sendEventToRenderers('ical:progress', {
  stage: 'fetching',
  progress: 10,
  message: 'Fetching calendar...',
});
sendEventToRenderers('ical:progress', {
  stage: 'parsing',
  progress: 30,
  message: 'Parsing events...',
});
sendEventToRenderers('ical:progress', {
  stage: 'importing',
  progress: 60,
  message: 'Importing assignments...',
});
sendEventToRenderers('ical:progress', {
  stage: 'complete',
  progress: 100,
  message: `Imported ${imported}, updated ${updated}, skipped ${skipped}`,
});

// In settings:upsert handler:
sendEventToRenderers('settings:changed', updatedSettings);
```

---

## Code Changes

### Modified Files

- `src/backend/main/ipc-handlers.ts` — verify/update all event emissions
- `src/backend/main/events.ts` — verify `sendEventToRenderers` implementation

### New Files

- `src/backend/main/__tests__/event-emission.test.ts` — verify events emitted correctly

---

## Acceptance Criteria

| #   | Criterion                                             | Verification                         |
| --- | ----------------------------------------------------- | ------------------------------------ |
| 1   | `db:changed` emitted on assignment insert             | Mock renderer, verify event received |
| 2   | `db:changed` emitted on assignment update             | Mock renderer, verify event received |
| 3   | `db:changed` emitted on assignment delete             | Mock renderer, verify event received |
| 4   | `db:changed` emitted on settings update               | Mock renderer, verify event received |
| 5   | `ical:progress` emitted at all 4 stages during import | Mock renderer, verify sequence       |
| 6   | `settings:changed` emitted with full Settings         | Mock renderer, verify payload        |
| 7   | Events received by preload bridge → frontend          | Integration test                     |
| 8   | No TypeScript errors                                  | `pnpm typecheck`                     |

---

## Notes

- Phase 0 already has `sendEventToRenderers` and basic event emission — this ticket **verifies and completes** it for Phase 1 needs
- Critical for Ticket 1.12 (auto-refresh) and Ticket 1.14 (sync status)
- Test with multiple renderer processes (multiple windows) to ensure broadcast works

---

## Release Summary

Verify main process emits all required events for frontend reactivity
