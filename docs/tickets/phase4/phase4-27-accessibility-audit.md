# Ticket: phase4-27-accessibility-audit

## Title
**Accessibility Audit & Fixes**

## Description
Full WCAG 2.1 AA audit on new UI (calendars settings, Pomodoro, graph). Playwright + axe-core E2E. Focus management, ARIA, color contrast, reduced motion.

## Acceptance Criteria
- [ ] Playwright + axe-core E2E test suite for all new Phase 4 features
- [ ] Zero axe-core violations (WCAG 2.1 A/AA) on:
  - Calendars Settings page
  - Pomodoro timer (compact + expanded + config modal)
  - Graph View (toolbar, canvas, legend)
  - Onboarding flow
  - Keyboard Shortcuts settings
- [ ] Focus management:
  - Modal focus trap
  - Focus restoration on close
  - Logical tab order
  - Skip links where appropriate
- [ ] ARIA:
  - Live regions for dynamic updates (sync status, Pomodoro timer)
  - Proper roles (toolbar, dialog, listbox, etc.)
  - Labels on all interactive elements
- [ ] Color contrast:
  - All text ≥ 4.5:1 (AA) or 3:1 (large text)
  - UI components ≥ 3:1
  - Graph nodes/links meet contrast
- [ ] Reduced motion:
  - Force simulation animation disabled
  - Onboarding transitions disabled
  - Pomodoro timer animations disabled
- [ ] Keyboard:
  - All features operable via keyboard
  - Graph: arrow keys navigate nodes, Enter activates
  - Pomodoro: Space start/pause, R reset, S skip
  - Onboarding: Tab/Enter/Escape navigation
- [ ] Documentation: `docs/architecture/accessibility.md` updated with Phase 4 patterns

## Technical Details

### Axe-Core E2E Test
```typescript
// src/frontend/src/__tests__/integration/phase4-accessibility.playwright.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PHASE4_PAGES = [
  { name: 'Calendars Settings', path: '/settings', setup: async (page) => { await page.click('[data-testid="calendars-tab"]'); } },
  { name: 'Pomodoro Compact', path: '/', setup: async (page) => { /* wait for TopBar */ } },
  { name: 'Pomodoro Panel', path: '/', setup: async (page) => { await page.click('[data-testid="pomodoro-timer"]'); } },
  { name: 'Pomodoro Config', path: '/', setup: async (page) => { await page.click('[data-testid="pomodoro-timer"]'); await page.click('[data-testid="pomodoro-config-btn"]'); } },
  { name: 'Graph View', path: '/notes/graph', setup: async (page) => { /* wait for graph */ } },
  { name: 'Onboarding', path: '/', setup: async (page) => { /* trigger onboarding */ } },
  { name: 'Keyboard Shortcuts', path: '/settings', setup: async (page) => { await page.click('[data-testid="shortcuts-tab"]'); } },
];

for (const pageConfig of PHASE4_PAGES) {
  test(`Accessibility: ${pageConfig.name}`, async ({ page }) => {
    await page.goto(pageConfig.path);
    if (pageConfig.setup) await pageConfig.setup(page);
    
    // Inject reduced motion CSS
    await page.addStyleTag({
      content: '* { animation: none !important; transition: none !important; }'
    });
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });
}
```

### Focus Management Patterns
```typescript
// Modal focus trap (reuse from Phase 3)
function useFocusTrap(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const focusable = containerRef.current!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    
    containerRef.current.addEventListener('keydown', handleKeyDown);
    first?.focus();
    return () => containerRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
  
  return containerRef;
}
```

### Live Regions
```tsx
// Pomodoro timer announcements
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {pomodoroState === 'running' && `Work session started, ${formatTime(timeRemaining)} remaining`}
  {phase === 'shortBreak' && `Break started, ${formatTime(timeRemaining)} remaining`}
  {phase === 'longBreak' && `Long break started, ${formatTime(timeRemaining)} remaining`}
</div>

// Sync status announcements
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {syncStatus === 'syncing' && `Syncing ${calendarName}`}
  {syncStatus === 'complete' && `Sync complete for ${calendarName}`}
  {syncStatus === 'error' && `Sync failed for ${calendarName}: ${errorMessage}`}
</div>
```

### Graph Keyboard Navigation
```typescript
// GraphRenderer.tsx - add keyboard support
function handleKeyDown(e: React.KeyboardEvent) {
  const { nodes, hoveredNodeId } = get();
  if (!hoveredNodeId) return;
  
  const hoveredIndex = nodes.findIndex(n => n.id === hoveredNodeId);
  if (hoveredIndex === -1) return;
  
  let newIndex = hoveredIndex;
  switch (e.key) {
    case 'ArrowRight': newIndex = (hoveredIndex + 1) % nodes.length; break;
    case 'ArrowLeft': newIndex = (hoveredIndex - 1 + nodes.length) % nodes.length; break;
    case 'ArrowDown': /* find child */ break;
    case 'ArrowUp': /* find parent */ break;
    case 'Enter': 
    case ' ': onNodeClick(nodes[hoveredIndex].id); break;
    case 'Escape': onNodeHover(null); break;
  }
  
  if (newIndex !== hoveredIndex) {
    onNodeHover(nodes[newIndex].id);
  }
}
```

### Color Contrast Fixes
- Graph nodes: Ensure node colors meet 3:1 against canvas background
- Calendar color badges: Test all 12 palette colors against light/dark themes
- Pomodoro timer: Ensure numbers meet 4.5:1
- Onboarding: All text meets contrast

## Dependencies
- Requires: All Phase 4 UI features implemented
- Requires: `@axe-core/playwright` (already in project)
- Requires: `docs/architecture/accessibility.md` (existing)

## Testing
- Run `pnpm test:e2e -- phase4-accessibility.playwright.ts` → 0 violations
- Manual test: NVDA/VoiceOver screen reader walkthrough
- Manual test: Keyboard-only navigation of all features
- Manual test: High contrast mode (Windows) / Increase contrast (macOS)
- Manual test: Reduced motion enabled → animations disabled

## Related
- `docs/architecture/accessibility.md` — Standards
- All Phase 4 UI tickets