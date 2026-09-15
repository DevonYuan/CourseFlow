# Ticket: phase4-16-graph-ui

## Title
**Graph View UI**

## Description
New route `/notes/graph` or tab in Notes workspace. Sidebar legend (depth colors). Toolbar: reset view, fit to screen, toggle physics. Loading skeleton while computing layout.

## Acceptance Criteria
- [ ] Route: `/notes/graph` (nested under NotesWorkspace like `/notes/:pageId`)
- [ ] Layout: Full-screen graph with toolbar top-right
- [ ] Toolbar buttons:
  - Reset View (home icon) → resets pan/zoom
  - Fit to Screen (expand icon) → auto-fits all nodes
  - Toggle Physics (play/pause icon) → pause/resume force simulation
  - Color Mode: Depth / Calendar (segmented control)
- [ ] Sidebar legend (collapsible):
  - Depth mode: color swatches for depth 0-5+
  - Calendar mode: color swatches for each calendar
- [ ] Loading state: skeleton nodes while force simulation settling
- [ ] Empty state: "No pages yet. Create a page to see the graph."
- [ ] Keyboard shortcuts: `R` reset, `F` fit, `P` pause physics
- [ ] Responsive: works at min-width 800px
- [ ] Accessible: ARIA labels, focus management

## Technical Details

### Route Structure
```tsx
// In App.tsx or NotesWorkspace routes
<Routes>
  <Route path="/notes" element={<NotesWorkspace />}>
    <Route index element={<NotesWelcome />} />
    <Route path=":pageId" element={<NotesWorkspace />} /> // existing
    <Route path="graph" element={<GraphView />} />       // NEW
    <Route path="search" element={<NotesSearchResults />} /> // existing
  </Route>
</Routes>
```

### GraphView Component
```tsx
// pages/GraphView.tsx
import { GraphRenderer } from '@/components/graph';
import { GraphToolbar } from '@/components/graph/GraphToolbar';
import { GraphLegend } from '@/components/graph/GraphLegend';
import { usePageTree } from '@/hooks/usePageTree';
import { useCalendarsStore } from '@/stores/calendarsStore';

export function GraphView() {
  const { tree, isLoading } = usePageTree();
  const { calendars } = useCalendarsStore();
  const [colorMode, setColorMode] = useState<'depth' | 'calendar'>('depth');
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  
  const graphData = useMemo(() => 
    pageTreeToGraph(tree, { 
      colorMode, 
      calendarColors: new Map(calendars.map(c => [c.id, c.color])) 
    }), 
    [tree, colorMode, calendars]
  );
  
  return (
    <div className="graph-view">
      <GraphToolbar
        transform={transform}
        onReset={() => setTransform({ x: 0, y: 0, k: 1 })}
        onFit={() => fitToScreen(graphData)} // compute bounds, set transform
        onTogglePhysics={() => setPhysicsEnabled(p => !p)}
        physicsEnabled={physicsEnabled}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
      />
      
      <div className="graph-view__canvas-container">
        {isLoading ? (
          <GraphSkeleton nodeCount={20} />
        ) : graphData.nodes.length === 0 ? (
          <GraphEmptyState />
        ) : (
          <GraphRenderer
            data={graphData}
            width={containerWidth}
            height={containerHeight}
            transform={transform}
            onTransformChange={setTransform}
            physicsEnabled={physicsEnabled}
            onNodeClick={id => navigate(`/notes/${id}`)}
            onNodeHover={setHoveredNode}
          />
        )}
      </div>
      
      <GraphLegend 
        mode={colorMode} 
        depths={getUniqueDepths(graphData.nodes)}
        calendars={calendars}
      />
    </div>
  );
}
```

### Toolbar Component
```tsx
// components/graph/GraphToolbar.tsx
export function GraphToolbar({ 
  transform, onReset, onFit, onTogglePhysics, physicsEnabled, 
  colorMode, onColorModeChange 
}) {
  return (
    <div className="graph-toolbar" role="toolbar" aria-label="Graph controls">
      <Button onClick={onReset} aria-label="Reset view (R)" title="Reset view (R)">
        <HomeIcon />
      </Button>
      <Button onClick={onFit} aria-label="Fit to screen (F)" title="Fit to screen (F)">
        <ExpandIcon />
      </Button>
      <Button 
        onClick={onTogglePhysics} 
        aria-label={physicsEnabled ? 'Pause physics (P)' : 'Resume physics (P)'}
        aria-pressed={physicsEnabled}
        title={physicsEnabled ? 'Pause physics (P)' : 'Resume physics (P)'}
      >
        {physicsEnabled ? <PauseIcon /> : <PlayIcon />}
      </Button>
      
      <div className="graph-toolbar__divider" />
      
      <SegmentedControl
        value={colorMode}
        onChange={onColorModeChange}
        options={[
          { value: 'depth', label: 'Depth' },
          { value: 'calendar', label: 'Calendar' },
        ]}
        aria-label="Color mode"
      />
    </div>
  );
}
```

### Legend Component
```tsx
// components/graph/GraphLegend.tsx
export function GraphLegend({ mode, depths, calendars }) {
  if (mode === 'depth') {
    return (
      <div className="graph-legend">
        <span className="graph-legend__label">Depth</span>
        {depths.slice().sort((a,b)=>a-b).map(depth => (
          <LegendItem key={depth} color={depthColor(depth)} label={`Level ${depth}`} />
        ))}
      </div>
    );
  }
  return (
    <div className="graph-legend">
      <span className="graph-legend__label">Calendars</span>
      {calendars.filter(c => c.enabled).map(cal => (
        <LegendItem key={cal.id} color={cal.color} label={cal.name} />
      ))}
    </div>
  );
}
```

### Loading Skeleton
```tsx
// GraphSkeleton: renders 20-30 placeholder nodes at random positions
// with pulse animation (respects prefers-reduced-motion)
```

## Dependencies
- Requires: `phase4-15-graph-renderer` (GraphRenderer)
- Requires: `phase4-14-graph-types` (transform)
- Requires: Phase 3 `usePageTree`, `notesStore`
- Requires: `calendarsStore` (from ticket 4.7)

## Testing
- Component test: Toolbar buttons call correct handlers
- Component test: Color mode toggle updates graph
- Component test: Loading skeleton shows while tree loading
- Component test: Empty state shows when no pages
- E2E test: Navigate to `/notes/graph`, interact with toolbar
- Accessibility test: axe-core scan

## Related
- `phase4-15-graph-renderer` — Renderer
- `phase4-17-graph-perf` — Performance
- Phase 3 Notes workspace routing