# Ticket: phase4-12-pomodoro-ui

## Title
**Pomodoro UI Component**

## Description
TopBar timer display (mm:ss) with phase indicator (work/break). Click to expand: start/pause/reset/skip, config button. Optional: dedicated `/pomodoro` route with larger timer, session history.

## Acceptance Criteria
- [ ] TopBar shows compact timer: `25:00` + phase icon (work/break)
- [ ] Click timer → expands to panel with:
  - Large timer display (mm:ss)
  - Phase label: "Focus", "Short Break", "Long Break"
  - Controls: Start/Pause, Reset, Skip
  - Gear icon → opens Pomodoro config modal
- [ ] Config modal: work/short/long break minutes, sessions until long break, toggles for auto-start breaks/work, sound, notifications
- [ ] Optional: `/pomodoro` route with full-screen timer, session history list, statistics
- [ ] Keyboard accessible: Space to start/pause, R to reset, S to skip, Escape to close panel
- [ ] ARIA live region announces phase changes
- [ ] Reduced motion: timer animations respect `prefers-reduced-motion`
- [ ] Theme-aware (light/dark)

## Technical Details

### Components
```
PomodoroTimer/           // TopBar compact + expanded panel
  PomodoroDisplay.tsx    // mm:ss + phase icon
  PomodoroPanel.tsx      // Expanded panel (popover)
  PomodoroControls.tsx   // Start/Pause, Reset, Skip buttons
  PomodoroConfigModal.tsx // Settings modal
  PomodoroPage.tsx       // Optional: /pomodoro route
  index.ts
```

### TopBar Integration
```tsx
// In TopBar.tsx
import { PomodoroTimer } from '@/components/pomodoro';

<TopBar>
  {/* ... existing items ... */}
  <PomodoroTimer />
</TopBar>
```

### Timer Display Format
```typescript
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

### Phase Icons/Colors
| Phase | Icon | Color (CSS var) |
|-------|------|-----------------|
| Work | 🎯 / target | `--accent` (teal) |
| Short Break | ☕ / coffee | `--accent-soft` |
| Long Break | 🌴 / palm | `--color-success` |

### Expanded Panel (Popover)
- Use existing `Popover` or `Dropdown` pattern from codebase
- Position: bottom-start relative to timer button
- Width: ~280px
- Close on outside click / Escape

### Config Modal Fields
```tsx
<ConfigModal>
  <NumberInput label="Work (min)" value={config.workMinutes} min={1} max={60} />
  <NumberInput label="Short Break (min)" value={config.shortBreakMinutes} min={1} max={30} />
  <NumberInput label="Long Break (min)" value={config.longBreakMinutes} min={1} max={60} />
  <NumberInput label="Sessions until Long Break" value={config.sessionsUntilLongBreak} min={2} max={10} />
  <Toggle label="Auto-start breaks" checked={config.autoStartBreaks} />
  <Toggle label="Auto-start work" checked={config.autoStartWork} />
  <Toggle label="Sound" checked={config.soundEnabled} />
  <Toggle label="Notifications" checked={config.notificationsEnabled} />
</ConfigModal>
```

### Optional: `/pomodoro` Route
- Full-screen timer with circular progress ring
- Session history: list of completed sessions with date/duration
- Statistics: total focus time today/week, streak
- Accessible via TopBar panel "Open Pomodoro" link

## Dependencies
- Requires: `phase4-11-pomodoro-store` (store)
- Requires: Phase 3 UI components (Button, Modal, Input, Toggle, Popover)

## Testing
- Component test: Compact display shows correct time/phase
- Component test: Expanded panel controls call store actions
- Component test: Config modal updates store + persists
- E2E test: Full Pomodoro cycle (work → break → work)
- Accessibility test: axe-core on panel + modal

## Related
- `phase4-11-pomodoro-store` — Store
- `phase4-13-pomodoro-notifications` — Notifications triggered from store
- `docs/architecture/accessibility.md` — WCAG 2.1 AA