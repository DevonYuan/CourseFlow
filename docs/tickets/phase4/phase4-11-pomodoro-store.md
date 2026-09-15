# Ticket: phase4-11-pomodoro-store

## Title
**Pomodoro Zustand Store**

## Description
Timer logic: countdown, phase transitions, session count, audio/visual notifications. Persist config to settings. Expose `start`, `pause`, `reset`, `skip` actions.

## Acceptance Criteria
- [ ] Store created at `src/frontend/src/stores/pomodoroStore.ts`
- [ ] State: `state`, `phase`, `timeRemaining`, `sessionCount`, `config`, `isTimerActive`
- [ ] Actions:
  - `start()` — begins countdown from current `timeRemaining` or full phase duration
  - `pause()` — pauses countdown, preserves `timeRemaining`
  - `reset()` — resets to full work phase, `sessionCount = 0`
  - `skip()` — advances to next phase immediately
  - `setConfig(config: Partial<PomodoroConfig>)` — updates config, persists to settings
  - `tick()` — called every second by timer, decrements `timeRemaining`, handles phase transitions
- [ ] Phase transitions:
  - Work → Short Break (after each work session)
  - Work → Long Break (after `sessionsUntilLongBreak` work sessions)
  - Break → Work (auto-start if `autoStartWork`/`autoStartBreaks`)
- [ ] Session history: on work phase completion, add to `completedSessions` (persisted)
- [ ] Config persisted to `settings.pomodoro` via `settings:set` IPC
- [ ] Timer cleanup on store unsubscribe (no memory leaks)
- [ ] Unit tests for all actions and phase transitions

## Technical Details

### Store Structure
```typescript
interface PomodoroStore {
  // State
  state: PomodoroState;
  phase: PomodoroPhase;
  timeRemaining: number;      // seconds
  sessionCount: number;       // completed work sessions in current cycle (0-3)
  config: PomodoroConfig;
  completedSessions: PomodoroSession[];
  isTimerActive: boolean;     // true when interval running
  
  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setConfig: (config: Partial<PomodoroConfig>) => Promise<void>;
  // Internal
  _tick: () => void;
  _setPhase: (phase: PomodoroPhase) => void;
  _completeSession: () => void;
}
```

### Timer Implementation
```typescript
// Use setInterval with 1000ms tick
let intervalId: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    get()._tick();
  }, 1000);
}

function stopTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function _tick() {
  const { timeRemaining, state } = get();
  if (state !== 'running') return;
  
  const newTime = timeRemaining - 1;
  if (newTime <= 0) {
    _completePhase();
  } else {
    set({ timeRemaining: newTime });
  }
}

function _completePhase() {
  const { phase, sessionCount, config } = get();
  
  if (phase === 'work') {
    // Work session completed
    const newSessionCount = sessionCount + 1;
    const isLongBreak = newSessionCount >= config.sessionsUntilLongBreak;
    
    // Record session
    const session: PomodoroSession = {
      id: crypto.randomUUID(),
      startedAt: Date.now() - (config.workMinutes * 60 * 1000),
      completedAt: Date.now(),
      phase: 'work',
      plannedDuration: config.workMinutes,
      actualDuration: config.workMinutes,
      completed: true,
    };
    
    set({ 
      completedSessions: [...get().completedSessions, session].slice(-100),
      sessionCount: isLongBreak ? 0 : newSessionCount,
    });
    
    // Transition to break
    _setPhase(isLongBreak ? 'longBreak' : 'shortBreak');
    
    if (config.autoStartBreaks) {
      startTimer();
    } else {
      set({ state: 'break' });
    }
  } else {
    // Break completed
    _setPhase('work');
    
    if (config.autoStartWork) {
      startTimer();
    } else {
      set({ state: 'break' }); // idle at work phase start
    }
  }
}

function _setPhase(phase: PomodoroPhase) {
  const { config } = get();
  const duration = phase === 'work' 
    ? config.workMinutes 
    : phase === 'shortBreak' 
      ? config.shortBreakMinutes 
      : config.longBreakMinutes;
  
  set({ 
    phase, 
    timeRemaining: duration * 60,
    state: 'idle'  // Will be set to 'running' by caller if auto-start
  });
}
```

### Persistence
```typescript
// On config change
setConfig: async (partialConfig) => {
  const newConfig = { ...get().config, ...partialConfig };
  set({ config: newConfig });
  // Persist to settings via IPC
  await window.api.settings.set({ pomodoro: { config: newConfig } });
},

// On app init: load from settings
// In store initialization or via hook
const loadConfig = async () => {
  const result = await window.api.settings.get();
  if (result.ok && result.data.pomodoro?.config) {
    set({ config: result.data.pomodoro.config });
  }
  if (result.ok && result.data.pomodoro?.completedSessions) {
    set({ completedSessions: result.data.pomodoro.completedSessions });
  }
};
```

## Dependencies
- Requires: `phase4-10-pomodoro-types` (types)
- Requires: `settings:set` / `settings:get` IPC (existing)

## Testing
- Unit test: `start` → `pause` → `start` resumes from correct time
- Unit test: `reset` clears session count, returns to work phase
- Unit test: 4 work sessions → long break, then cycle resets
- Unit test: `skip` advances phase correctly
- Unit test: Config change persists to settings
- Unit test: Session history recorded and limited to 100 entries

## Related
- `phase4-10-pomodoro-types` — Types
- `phase4-12-pomodoro-ui` — UI consumes store
- `phase4-13-pomodoro-notifications` — Store triggers notifications