# Ticket: phase4-28-performance

## Title
**Performance Profiling**

## Description
Profile startup time, memory usage, sync duration with 1000+ assignments. Optimize: lazy-load notes workspace, virtualize assignment list, memoize selectors.

## Acceptance Criteria
- [ ] Startup time < 2s (cold) on mid-range hardware
- [ ] Memory usage < 200MB baseline (main + renderer)
- [ ] Sync duration < 5s for 1000 assignments across 5 calendars
- [ ] Assignment list: virtualized (react-window) for >500 items
- [ ] Notes workspace: lazy-loaded (code-split)
- [ ] Graph view: Web Worker for force sim (ticket 4.17)
- [ ] Selectors memoized (reselect or Zustand built-in)
- [ ] Bundle size: < 50MB total (all platforms)
- [ ] Performance regression tests in CI
- [ ] Profiling guide in docs

## Technical Details

### Startup Optimization
```typescript
// main.ts - defer non-critical work
app.whenReady().then(async () => {
  // Critical: create window, load renderer
  createWindow();
  
  // Defer: database migration, scheduler start, auto-updater check
  setTimeout(() => {
    runMigrations();
    initScheduler();
    initAutoUpdater();
  }, 1000);
});
```

### Assignment List Virtualization
```tsx
// components/assignments/AssignmentList.tsx
import { FixedSizeList as List } from 'react-window';

function AssignmentList({ assignments, height = 600, itemHeight = 56 }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <AssignmentRow assignment={assignments[index]} />
    </div>
  );
  
  return (
    <List
      height={height}
      itemCount={assignments.length}
      itemSize={itemHeight}
      width="100%"
      overscanCount={5}
    >
      {Row}
    </List>
  );
}
```

### Notes Workspace Lazy Loading
```typescript
// App.tsx
const NotesWorkspace = lazy(() => import('./pages/NotesWorkspace').then(m => ({ default: m.NotesWorkspace })));
const GraphView = lazy(() => import('./pages/GraphView').then(m => ({ default: m.GraphView })));
const PomodoroPage = lazy(() => import('./pages/PomodoroPage').then(m => ({ default: m.PomodoroPage })));

// In routes
<Suspense fallback={<PageSkeleton />}>
  <Route path="/notes/*" element={<NotesWorkspace />} />
  <Route path="/pomodoro" element={<PomodoroPage />} />
</Suspense>
```

### Selector Memoization
```typescript
// stores/assignmentsStore.ts - use shallow equality
import { createSelector } from 'reselect'; // or Zustand's built-in

// Instead of inline filter in component:
const useFilteredAssignments = () => useAssignmentsStore(
  createSelector(
    (state) => state.assignments,
    (state) => state.filterState,
    (assignments, filter) => applyFilters(assignments, filter)
  )
);
```

### Sync Performance
```typescript
// Batch database operations in importAssignments
async function importAssignments(assignments: AssignmentInput[], options) {
  const db = getDatabase();
  
  // Single transaction for all upserts
  db.exec('BEGIN TRANSACTION');
  try {
    // Prepare statement once
    const stmt = db.prepare(`
      INSERT INTO assignments (...) VALUES (...)
      ON CONFLICT(source_id, ical_uid) DO UPDATE SET ...
    `);
    
    for (const a of assignments) {
      stmt.run(...values);
    }
    
    // Single prune statement
    db.run(pruneSql, [sourceId, ...uids]);
    
    db.exec('COMMIT');
    saveDatabase(); // Single export
  } catch {
    db.exec('ROLLBACK');
    throw err;
  }
}
```

### Bundle Analysis
```bash
# Add to package.json
"scripts": {
  "analyze": "vite build --mode production && npx vite-bundle-analyzer dist/frontend"
}
```

### CI Performance Regression
```yaml
# .github/workflows/performance.yml
name: Performance Regression

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * 0'  # Weekly

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test -- --pool=forks --poolOptions.forks.singleFork
      - name: Measure startup
        run: |
          # Use electron-launch-time or similar
          node scripts/measure-startup.js
      - name: Check bundle size
        run: |
          SIZE=$(du -sh dist/ | cut -f1)
          if [ $(echo $SIZE | sed 's/M//') -gt 50 ]; then exit 1; fi
```

## Dependencies
- Requires: `pnpm add react-window @types/react-window`
- Requires: Phase 4 features implemented

## Testing
- Performance test: Startup time measurement script
- Memory test: Heap snapshot analysis
- Sync test: 1000 assignments × 5 calendars timing
- Bundle size check: CI fails if > 50MB
- Regression: Compare metrics to baseline

## Related
- `phase4-17-graph-perf` — Graph performance
- `phase4-15-graph-renderer` — Canvas rendering
- `phase4-06-scheduler-multi` — Sync performance