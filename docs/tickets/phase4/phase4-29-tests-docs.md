# Ticket: phase4-29-tests-docs

## Title
**Tests & Documentation**

## Description
Unit tests (calendars repo/IPC, Pomodoro store, graph transform). Component tests (CalendarsSettings, PomodoroTimer, GraphView). E2E (multi-calendar sync, Pomodoro flow). Update `docs/architecture/data-model.md`, `ipc-contract.md`, `multi-calendar.md`, root README.

## Acceptance Criteria
- [ ] Unit tests:
  - Calendars repository CRUD + reorder + encryption
  - Calendars IPC handlers (all 7)
  - Pomodoro store (all actions, phase transitions, persistence)
  - Graph transform (pageTreeToGraph with various trees)
  - Migration v6 (clean DB, existing DB with icalUrl, backfill)
  - Scheduler multi-source (sequential, error isolation, progress events)
- [ ] Component tests:
  - CalendarsSettings (list, add, delete, reorder, toggle)
  - PomodoroTimer (compact, panel, config modal)
  - GraphView (toolbar, renderer, legend, loading/empty states)
  - Onboarding (all steps, skip, completion)
  - KeyboardShortcuts (recorder, conflict detection)
- [ ] E2E tests:
  - Multi-calendar sync: add 2 calendars, sync, verify unified list
  - Pomodoro flow: start → pause → complete work → break → work
  - Graph: navigate to `/notes/graph`, click node → opens page
  - Onboarding: fresh install → complete → calendar created
  - Protocol: `courseflow://open?page=x` → opens page
- [ ] Documentation updated:
  - `docs/architecture/data-model.md` — CalendarSource entity
  - `docs/architecture/ipc-contract.md` — Calendar + Pomodoro + Protocol channels
  - `docs/architecture/multi-calendar.md` — Implementation status
  - `docs/architecture/process-model.md` — Updater, protocol, menus
  - Root README — v0.4 features, installation
- [ ] All tests pass in CI (`pnpm test`, `pnpm test:e2e`)

## Technical Details

### Unit Test Structure
```typescript
// src/backend/main/db/__tests__/calendars.test.ts
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createTestDb } from '../test-utils';

describe('Calendars Repository', () => {
  let db: Database;
  let repo: Repository;
  
  beforeAll(() => {
    db = createTestDb();
    repo = new Repository(db);
  });
  
  it('creates calendar with encrypted feed_url', async () => {
    const cal = await repo.createCalendar({ name: 'Test', feed_url: 'https://example.com/cal.ics' });
    expect(cal.feed_url).not.toContain('https://'); // encrypted
    expect(cal.enabled).toBe(true);
  });
  
  it('reorderCalendars handles move up/down', async () => {
    // ...
  });
});

// src/backend/main/__tests__/ipc-calendars.test.ts
describe('Calendars IPC Handlers', () => {
  it('db:calendars:create validates URL', async () => {
    const result = await ipcMain.handle('db:calendars:create', { name: 'Test', feed_url: 'not-a-url' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });
});

// src/frontend/src/stores/__tests__/pomodoroStore.test.ts
describe('Pomodoro Store', () => {
  it('completes work session → short break', () => {
    const { start, _tick } = get();
    start();
    // Simulate 25 min
    for (let i = 0; i < 25 * 60; i++) _tick();
    expect(get().phase).toBe('shortBreak');
  });
});

// src/frontend/src/utils/__tests__/graphTransform.test.ts
describe('pageTreeToGraph', () => {
  it('flat tree → nodes only, no links', () => {
    const tree = [{ id: '1', title: 'A', children: [] }, { id: '2', title: 'B', children: [] }];
    const { nodes, links } = pageTreeToGraph(tree);
    expect(nodes).toHaveLength(2);
    expect(links).toHaveLength(0);
  });
});
```

### Component Test Patterns
```tsx
// src/frontend/src/components/settings/__tests__/CalendarsSettings.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarsSettings } from '../CalendarsSettings';
import { mockWindowApi } from '@/test/test-utils';

test('add calendar form submits', async () => {
  mockWindowApi({
    db: {
      calendars: {
        create: vi.fn().mockResolvedValue({ ok: true, data: { id: '1', name: 'Test', ... } }),
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      }
    }
  });
  
  render(<CalendarsSettings />);
  
  await fireEvent.click(screen.getByText('Add Calendar'));
  await fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Calendar' } });
  await fireEvent.change(screen.getByLabelText('iCal URL'), { target: { value: 'https://cal.example.com/feed.ics' } });
  await fireEvent.click(screen.getByText('Save'));
  
  expect(window.api.db.calendars.create).toHaveBeenCalledWith(expect.objectContaining({
    name: 'My Calendar',
    feed_url: 'https://cal.example.com/feed.ics',
  }));
});
```

### E2E Test Patterns
```typescript
// src/frontend/src/__tests__/integration/phase4-multi-calendar.playwright.ts
test('Multi-calendar sync', async ({ page }) => {
  await page.goto('/');
  
  // Add Calendar A
  await page.click('[data-testid="settings-btn"]');
  await page.click('[data-testid="calendars-tab"]');
  await page.click('[data-testid="add-calendar-btn"]');
  await page.fill('[name="name"]', 'Google Calendar');
  await page.fill('[name="feedUrl"]', 'https://calendar.google.com/ical/abc.ics');
  await page.click('[data-testid="save-calendar"]');
  
  // Add Calendar B
  await page.click('[data-testid="add-calendar-btn"]');
  await page.fill('[name="name"]', 'Canvas');
  await page.fill('[name="feedUrl"]', 'https://canvas.example.com/ical/xyz.ics');
  await page.click('[data-testid="save-calendar"]');
  
  // Trigger sync
  await page.click('[data-testid="sync-now"]');
  
  // Wait for sync complete
  await expect(page.locator('[data-testid="calendar-sync-status"]')).toContainText('Synced');
  
  // Verify unified list shows both colors
  const badges = page.locator('.assignment-row__calendar-badge');
  await expect(badges).toHaveCount(/* > 0 */);
});

// Pomodoro E2E
test('Pomodoro flow', async ({ page }) => {
  await page.goto('/');
  
  // Start timer
  await page.click('[data-testid="pomodoro-timer"]');
  await page.click('[data-testid="pomodoro-start"]');
  
  // Wait for phase transition (mock time or wait)
  await page.waitForTimeout(1000);
  
  // Verify phase changed
  await expect(page.locator('[data-testid="pomodoro-phase"]')).toContainText('Break');
});
```

### Documentation Updates Checklist
- [ ] `data-model.md`: Add `CalendarSource` entity, `PomodoroConfig`, `PomodoroSession`
- [ ] `ipc-contract.md`: Add `db:calendars:*`, `updater:*`, `shortcut:*`, `protocol:*` channels
- [ ] `multi-calendar.md`: Update status to "Implemented", add implementation notes
- [ ] `process-model.md`: Document auto-updater, protocol handler, native menus
- [ ] Root README: v0.4 feature list, updated installation/build instructions

## Dependencies
- Requires: All Phase 4 implementation tickets complete
- Requires: Test infrastructure (vitest, playwright) configured

## Testing
- Run full unit suite: `pnpm test -- --pool=forks --poolOptions.forks.singleFork`
- Run E2E suite: `pnpm test:e2e`
- Verify documentation renders correctly (if using docs site)

## Related
- All Phase 4 tickets
- `docs/architecture/` — Documentation targets
- CI: `.github/workflows/ci.yml` (add Phase 4 tests)