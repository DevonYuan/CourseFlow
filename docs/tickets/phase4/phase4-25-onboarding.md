# Ticket: phase4-25-onboarding

## Title
**First-Run Onboarding**

## Description
Welcome screen: explain iCal URL, demo calendar, create first calendar source, tour of features (priority, sub-tasks, notes, Pomodoro). Skip option.

## Acceptance Criteria
- [ ] Onboarding shows on first app launch (detected via settings flag)
- [ ] Step 1: Welcome + value proposition (1 screen)
- [ ] Step 2: iCal URL explanation + demo calendar option (paste URL or "Use Demo Calendar")
- [ ] Step 3: Feature tour (priority ordering, sub-tasks, notes, Pomodoro) — interactive or screenshots
- [ ] Step 4: Create first calendar source (if not using demo) — pre-filled form
- [ ] Step 5: Success screen + "Start Using CourseFlow"
- [ ] Skip button at each step (stores `onboardingComplete: true` in settings)
- [ ] "Show onboarding again" option in Settings
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Keyboard navigable (Tab, Enter, Escape)
- [ ] Accessible: ARIA labels, focus management, screen reader friendly

## Technical Details

### Onboarding Flow State
```typescript
// stores/onboardingStore.ts
interface OnboardingState {
  step: number;           // 0-4
  isComplete: boolean;    // persisted in settings
  demoMode: boolean;      // user chose demo calendar
  calendarData: CalendarSourceInput | null;
}

interface OnboardingActions {
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  setDemoMode: (enabled: boolean) => void;
  setCalendarData: (data: Partial<CalendarSourceInput>) => void;
}
```

### Settings Persistence
```typescript
// In settings table, key = 'onboarding'
{
  complete: boolean,
  version: number,  // for future onboarding updates
  completedAt: number,
  demoMode: boolean
}
```

### Components
```
OnboardingModal/           // Full-screen overlay
  OnboardingStep1Welcome.tsx
  OnboardingStep2Calendar.tsx
  OnboardingStep3Features.tsx
  OnboardingStep4CreateCalendar.tsx
  OnboardingStep5Complete.tsx
  OnboardingProgress.tsx   // Step indicators
  OnboardingNavigation.tsx // Prev/Next/Skip buttons
```

### Step 2: Calendar Setup
```tsx
function OnboardingStep2Calendar() {
  const { demoMode, setDemoMode, calendarData, setCalendarData } = useOnboardingStore();
  
  return (
    <div className="onboarding-step">
      <h2>Connect Your Calendar</h2>
      <p>CourseFlow imports assignments from any iCal feed (Google Calendar, Canvas, Outlook, etc.)</p>
      
      <label>
        <input 
          type="radio" 
          checked={demoMode} 
          onChange={() => setDemoMode(true)} 
        />
        <span>Use Demo Calendar (sample assignments)</span>
      </label>
      
      <label>
        <input 
          type="radio" 
          checked={!demoMode} 
          onChange={() => setDemoMode(false)} 
        />
        <span>Add My Calendar</span>
      </label>
      
      {!demoMode && (
        <CalendarForm 
          initialData={calendarData}
          onChange={setCalendarData}
          showHelp={true}
        />
      )}
    </div>
  );
}
```

### Step 3: Feature Tour
```tsx
function OnboardingStep3Features() {
  const features = [
    { icon: <GripVerticalIcon />, title: 'Priority Ordering', desc: 'Drag assignments to reorder by your priorities, not just due dates.' },
    { icon: <CheckSquareIcon />, title: 'Sub-tasks', desc: 'Break assignments into smaller steps and track progress.' },
    { icon: <FileTextIcon />, title: 'Notes & Pages', desc: 'Take notes per assignment or create standalone Notion-style pages.' },
    { icon: <TimerIcon />, title: 'Pomodoro Timer', desc: 'Built-in focus timer with work/break cycles.' },
  ];
  
  return (
    <div className="onboarding-step">
      <h2>What You Can Do</h2>
      <div className="feature-grid">
        {features.map(f => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </div>
  );
}
```

### Demo Calendar
- Provide a sample `.ics` file with realistic assignments
- If user selects demo: create calendar source with demo feed URL (bundled or hosted)
- Pre-populate with 10-15 assignments across multiple courses

### Integration
```tsx
// In App.tsx
useEffect(() => {
  const checkOnboarding = async () => {
    const result = await window.api.settings.get();
    if (result.ok && !result.data.onboarding?.complete) {
      setShowOnboarding(true);
    }
  };
  checkOnboarding();
}, []);

{showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
```

## Dependencies
- Requires: `phase4-07-calendars-settings-ui` (CalendarForm reuse)
- Requires: Settings IPC (existing)
- Requires: Phase 3 features exist for tour

## Testing
- Component test: Each step renders correctly
- Component test: Navigation works (next/prev/skip)
- Component test: Demo mode creates calendar source
- Component test: Completion sets `onboarding.complete = true`
- E2E test: Fresh install → onboarding shows → complete → app usable
- E2E test: Skip onboarding → app usable
- Accessibility test: axe-core on each step

## Related
- `phase4-07-calendars-settings-ui` — Calendar form
- `phase4-26-keyboard-shortcuts` — Shortcuts reference in onboarding