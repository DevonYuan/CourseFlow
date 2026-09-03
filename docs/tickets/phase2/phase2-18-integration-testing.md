---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-18-integration-testing

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 1 day

---

## Description

End-to-end integration testing of all Phase 2 features. Verify full flows: drag-drop reorder → restart → order persists → re-import iCal → priority preserved → filter/sort/group work → auto-sync runs in background → UI updates via `db:changed` events.

---

## Requirements

### Functional

- [ ] **Test 1: Priority Persistence**
  - Drag-drop reorder assignments
  - Restart app (quit + launch)
  - Verify order preserved exactly
- [ ] **Test 2: Re-import Preserves Priority**
  - Set custom priority order
  - Trigger manual "Sync Now" (or wait for background)
  - Verify custom order unchanged, new assignments at bottom
- [ ] **Test 3: Filter/Sort/Group Combinations**
  - Apply course filter + status filter + date range + search
  - Change sort option (each of 5)
  - Change grouping (each of 4 + none)
  - Verify correct results in all combos
- [ ] **Test 4: Background Scheduler**
  - Set `sync_interval_minutes = 1` (for testing)
  - Verify background fetch runs at interval
  - Verify `scheduler:tick` events update UI countdown
  - Verify imports work and UI updates via `db:changed`
- [ ] **Test 5: Manual + Background Coalescing**
  - Start background scheduler
  - Click "Sync Now" during background fetch
  - Verify manual ignored with toast, no duplicate fetch
- [ ] **Test 6: Keyboard Reordering**
  - Focus assignment, `Alt+Up/Down` moves correctly
  - `Alt+Shift+Up/Down` moves to top/bottom
  - Screen reader announces changes
- [ ] **Test 7: Error Scenarios**
  - Invalid iCal URL → scheduler pauses, error toast
  - Network offline → scheduler retries, no crash
  - Malformed iCal → parse error, scheduler pauses

### Non-Functional

- [ ] All tests documented with steps, expected results
- [ ] Automated where possible (Vitest for unit, Playwright for E2E)
- [ ] Manual test checklist for UI/UX validation
- [ ] Performance: list renders <100ms with 500 assignments

---

## Designs & Constraints

- **Unit tests**: Vitest — test selectors (2.9), grouping (2.10), scheduler logic (2.13)
- **E2E tests**: Playwright — critical user flows (Test 1, 2, 4, 5)
- **Manual tests**: Accessibility, visual, error scenarios
- **Test data**: Use Google Calendar iCal + mock Canvas .ics (per Phase 2 manual testing notes)

### Playwright Test Scenarios

```typescript
// test: priority persists across restart
await page.goto('/')
await dragAndDrop(page, 'assignment-1', 'assignment-3')
await page.reload()
await expectOrder(page, ['assignment-3', 'assignment-1', 'assignment-2'])

// test: background scheduler
await page.goto('/settings')
await setSyncInterval(page, 1) // 1 minute
await page.goto('/')
await waitForSchedulerTick(page) // verify tick event
await expectAssignmentsUpdated(page)
```

---

## Code Changes

### New Files

- `src/frontend/src/__tests__/integration/phase2-e2e.spec.ts` (Playwright)
- `src/backend/main/__tests__/scheduler.integration.test.ts` (Vitest)
- `src/frontend/src/store/__tests__/selectors.test.ts` (Vitest)
- `src/frontend/src/store/__tests__/grouping.test.ts` (Vitest)

### Modified Files

- `package.json` — ensure test scripts include new test files
- `playwright.config.ts` — configure if needed

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | All 7 functional test scenarios pass | Test run |
| 2 | Unit tests cover selectors, grouping, scheduler logic | Coverage >80% |
| 3 | Playwright E2E tests pass for critical flows | CI run |
| 4 | Manual accessibility checklist complete | Checklist |
| 5 | Performance: 500 assignments render <100ms | Manual profile |
| 6 | No console errors in normal operation | Manual test |
| 7 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- This ticket **closes Phase 2** — all features must integrate cleanly
- Coordinate with manual testing plan (Google Calendar iCal + mock Canvas .ics)
- Playwright tests run in CI — ensure `pnpm test:e2e` works
- Vitest tests run in `pnpm test` — keep fast (<30s total)
- Document any known issues/limitations for Phase 3 planning

---

## Release Summary

Complete end-to-end integration testing of Phase 2: priority, filters, grouping, scheduler