# Ticket: phase4-10-pomodoro-types

## Title
**Pomodoro Types & State**

## Description
Define `PomodoroState`: `idle` \| `running` \| `paused` \| `break`. `PomodoroConfig`: `workMinutes` (default 25), `shortBreakMinutes` (5), `longBreakMinutes` (15), `sessionsUntilLongBreak` (4). Add to `Settings` or dedicated `pomodoro` key.

## Acceptance Criteria
- [ ] Types defined in `src/backend/shared/types.ts`:
  - `PomodoroState` type
  - `PomodoroPhase` type: `'work' | 'shortBreak' | 'longBreak'`
  - `PomodoroConfig` interface
  - `PomodoroSession` interface (for history)
- [ ] Settings key: `pomodoro` (JSON) with `config` + `sessionCount` + `completedSessions`
- [ ] Default config values match standard Pomodoro technique
- [ ] Types exported and usable by renderer via `@backend/shared/types`

## Technical Details

### Types (src/backend/shared/types.ts)
```typescript
export type PomodoroState = 'idle' | 'running' | 'paused' | 'break';
export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';

export interface PomodoroConfig {
  workMinutes: number;              // default 25
  shortBreakMinutes: number;        // default 5
  longBreakMinutes: number;         // default 15
  sessionsUntilLongBreak: number;   // default 4
  autoStartBreaks: boolean;         // default true
  autoStartWork: boolean;           // default false
  soundEnabled: boolean;            // default true
  notificationsEnabled: boolean;    // default true
}

export interface PomodoroSession {
  id: EntityId;
  startedAt: number;           // Unix ms
  completedAt: number | null;  // Unix ms
  phase: PomodoroPhase;
  plannedDuration: number;     // minutes
  actualDuration: number;      // minutes (may differ if paused/stopped early)
  completed: boolean;
}

export interface PomodoroStateSnapshot {
  state: PomodoroState;
  phase: PomodoroPhase;
  timeRemaining: number;       // seconds
  sessionCount: number;        // completed work sessions in current cycle
  config: PomodoroConfig;
}
```

### Settings Storage
```typescript
// In settings table, key = 'pomodoro'
{
  config: PomodoroConfig,           // user preferences
  sessionCount: number,             // completed work sessions (resets after long break)
  completedSessions: PomodoroSession[], // history (last 100)
  updatedAt: number
}
```

### Default Config
```typescript
const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartWork: false,
  soundEnabled: true,
  notificationsEnabled: true,
};
```

## Dependencies
- None (pure types)

## Testing
- TypeScript compile: types exported correctly
- Unit test: Default config matches spec

## Related
- `phase4-11-pomodoro-store` — Zustand store uses these types
- `phase4-12-pomodoro-ui` — UI displays state
- `phase4-13-pomodoro-notifications` — Notifications use config