---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-12-grouping-persist

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** Low  
**Estimated Effort:** 0.25 day

---

## Description

Persist selected grouping type to `localStorage` (or settings table). Restore on app launch. Part of FilterState persistence (ticket 2.6).

---

## Requirements

### Functional

- [ ] `groupingType` already in `FilterState` (ticket 2.6) — persists via existing localStorage mechanism
- [ ] On app launch, `groupingType` hydrated from localStorage
- [ ] Default: `'none'` (flat list)
- [ ] No per-group collapse state persistence (session only)

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] No additional code needed if ticket 2.6 persistence works correctly
- [ ] Verify hydration order: FilterState hydrates before AssignmentList renders

---

## Designs & Constraints

- **Persistence**: Handled by `FilterState` localStorage in ticket 2.6
- **Key**: `courseflow:filters` includes `groupingType`
- **Hydration**: Store `initialize` action reads localStorage before first render

---

## Code Changes

### New Files

- None

### Modified Files

- `src/frontend/src/store/useAssignmentStore.ts` — verify `groupingType` in persisted state (already in ticket 2.6)
- `src/frontend/src/App.tsx` — ensure store initializes before rendering (already done)

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Select "By Course" grouping → reload app → grouping persists | Manual test |
| 2 | Default is "Flat List" (none) on fresh install | Manual test |
| 3 | No console errors on hydration | Manual test |
| 4 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- This ticket is mostly verification — persistence implemented in ticket 2.6
- Per-group collapse state intentionally NOT persisted (resets on reload)
- If user wants different default, add to Settings page (Phase 3+)

---

## Release Summary

Persist grouping selection to localStorage via existing FilterState mechanism