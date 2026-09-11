---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-05-priority-keyboard

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 0.5 day

---

## Description

Add keyboard shortcuts for priority reordering: `Alt+Up/Down` to move assignment up/down, `Alt+Shift+Up/Down` to move to top/bottom. Announce changes via ARIA live region for screen readers.

---

## Requirements

### Functional

- [ ] `Alt+Up` / `Alt+Down`: Move focused assignment up/down by one position
- [ ] `Alt+Shift+Up` / `Alt+Shift+Down`: Move focused assignment to top/bottom
- [ ] Focus management: after move, keep focus on moved assignment row
- [ ] ARIA live region announces: "Moved [title] to position [n] of [total]"
- [ ] Shortcuts work when assignment row or drag handle is focused
- [ ] Disabled for completed assignments (or skip them in movement)
- [ ] Visual focus indicator (already exists from global styles)

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Shortcuts registered globally (not just in list) but only active when list focused
- [ ] No conflict with browser/OS shortcuts (Alt+Up/Down typically unused)
- [ ] Accessible: screen reader announces position change immediately
- [ ] Keyboard sensor for `@dnd-kit` already handles Space/arrows/Enter — this adds direct shortcuts

---

## Designs & Constraints

- **Library**: `@dnd-kit` `KeyboardSensor` handles drag via keyboard; this ticket adds _direct_ shortcuts without entering drag mode
- **Implementation**: Use `useHotkeys` from `react-hotkeys-hook` or custom `useEffect` with `keydown` listener
- **Live region**: `<div aria-live="polite" aria-atomic="true" className="sr-only" />` in `AssignmentList`
- **Focus**: Each `AssignmentRow` has `tabIndex={0}` and `onFocus` to track current index
- **Completed assignments**: Filter out from keyboard navigation or skip silently

### Keyboard Mapping

| Shortcut         | Action                         |
| ---------------- | ------------------------------ |
| `Alt+Up`         | Move up 1 (swap with previous) |
| `Alt+Down`       | Move down 1 (swap with next)   |
| `Alt+Shift+Up`   | Move to top (position 0)       |
| `Alt+Shift+Down` | Move to bottom (last position) |

### Zustand Action

```typescript
moveAssignment: (assignmentId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void
```

---

## Code Changes

### New Files

- `src/frontend/src/hooks/usePriorityKeyboard.ts` — custom hook for keyboard shortcuts
- `src/frontend/src/components/AssignmentList/PriorityLiveRegion.tsx` — ARIA live region component

### Modified Files

- `src/frontend/src/components/AssignmentList/AssignmentList.tsx` — integrate keyboard hook + live region
- `src/frontend/src/components/AssignmentList/AssignmentRow.tsx` — ensure `tabIndex`, focus handling
- `src/frontend/src/store/useAssignmentStore.ts` — add `moveAssignment` action

---

## Acceptance Criteria

| #   | Criterion                                       | Verification                 |
| --- | ----------------------------------------------- | ---------------------------- |
| 1   | `Alt+Up` moves assignment up one position       | Manual test                  |
| 2   | `Alt+Down` moves assignment down one position   | Manual test                  |
| 3   | `Alt+Shift+Up` moves to top                     | Manual test                  |
| 4   | `Alt+Shift+Down` moves to bottom                | Manual test                  |
| 5   | Screen reader announces "Moved X to position Y" | Manual test (NVDA/VoiceOver) |
| 6   | Focus stays on moved assignment                 | Manual test                  |
| 7   | Completed assignments skipped                   | Manual test                  |
| 8   | All tests pass (`pnpm test`)                    | CI run                       |

---

## Notes

- `@dnd-kit` `KeyboardSensor` uses Space/Enter/Arrows for drag — our shortcuts are _alternative_ direct manipulation
- Test on macOS (Option key) and Windows/Linux (Alt key) — both map to `event.altKey`
- Live region: use `polite` not `assertive` to avoid interrupting user
- Position announced is 1-based (user-friendly), internal is 0-based
- Consider adding `Alt+Number` (1-9) to jump to position (deferred)

---

## Release Summary

Add keyboard shortcuts (Alt+Up/Down, Alt+Shift+Up/Down) for priority reordering with screen reader announcements
