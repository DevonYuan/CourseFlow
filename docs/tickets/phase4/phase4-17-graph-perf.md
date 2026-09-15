# Ticket: phase4-17-graph-perf

## Title
**Performance Optimization**

## Description
Virtualize nodes (only render visible), debounce layout on data change, memoize transform. Web Worker for force simulation if >200 nodes.

## Acceptance Criteria
- [ ] Force simulation runs in Web Worker (off main thread) for >200 nodes
- [ ] Viewport culling: only draw nodes within visible canvas bounds (+ margin)
- [ ] Transform memoized: `pageTreeToGraph` only recomputes when tree structure changes
- [ ] Debounced layout restart: 300ms debounce on data changes
- [ ] Level-of-detail: simplify node rendering at low zoom (dots only)
- [ ] Performance budget: <16ms frame time (60fps) with 1000 nodes
- [ ] Memory: no leaks during simulation start/stop
- [ ] Unit tests for transform memoization, culling logic

## Technical Details

### Web Worker for Force Simulation
```typescript
// workers/graphForce.worker.ts
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

type WorkerMessage = 
  | { type: 'init'; nodes: GraphNode[]; links: GraphLink[]; width: number; height: number }
  | { type: 'update'; nodes: GraphNode[]; links: GraphLink[] }
  | { type: 'tick' }
  | { type: 'stop' }
  | { type: 'config'; forces: ForceConfig };

let simulation: any = null;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  switch (e.data.type) {
    case 'init':
      simulation = forceSimulation(e.data.nodes)
        .force('link', forceLink(e.data.links).id((d: any) => d.id).distance(80))
        .force('charge', forceManyBody().strength(-300))
        .force('center', forceCenter(e.data.width / 2, e.data.height / 2))
        .force('collide', forceCollide().radius((d: any) => 20 + (d.title?.length || 0) * 3))
        .alphaDecay(0.02)
        .on('tick', () => {
          // Send positions back to main thread
          self.postMessage({ 
            type: 'positions', 
            nodes: simulation.nodes().map((n: any) => ({ id: n.id, x: n.x, y: n.y, vx: n.vx, vy: n.vy }))
          });
        });
      break;
    case 'update':
      // Restart with new data
      simulation.nodes(e.data.nodes);
      simulation.force('link').links(e.data.links);
      simulation.alpha(1).restart();
      break;
    case 'stop':
      simulation?.stop();
      break;
  }
};
```

### Main Thread Integration
```typescript
// GraphRenderer.tsx - use Worker
const workerRef = useRef<Worker>();

useEffect(() => {
  workerRef.current = new Worker(new URL('./graphForce.worker.ts', import.meta.url), { type: 'module' });
  
  workerRef.current.onmessage = (e) => {
    if (e.data.type === 'positions') {
      // Update node positions in React state (batched)
      setNodePositions(new Map(e.data.nodes.map((n: any) => [n.id, { x: n.x, y: n.y }])));
    }
  };
  
  workerRef.current.postMessage({ 
    type: 'init', 
    nodes: data.nodes, 
    links: data.links, 
    width, 
    height 
  });
  
  return () => workerRef.current?.terminate();
}, [data.nodes, data.links, width, height]);
```

### Viewport Culling
```typescript
function getVisibleNodes(
  nodes: GraphNode[], 
  transform: { x: number; y: number; k: number },
  canvasWidth: number,
  canvasHeight: number,
  margin: number = 100
): GraphNode[] {
  const { x, y, k } = transform;
  const left = (-x - margin) / k;
  const right = (-x + canvasWidth + margin) / k;
  const top = (-y - margin) / k;
  const bottom = (-y + canvasHeight + margin) / k;
  
  return nodes.filter(node => 
    node.x !== undefined && 
    node.y !== undefined &&
    node.x + 20 > left && node.x - 20 < right &&
    node.y + 20 > top && node.y - 20 < bottom
  );
}
```

### Level of Detail (LOD)
```typescript
function drawNode(ctx: CanvasRenderingContext2D, node: GraphNode, zoom: number) {
  const radius = Math.max(8, 12 * zoom);
  
  if (zoom < 0.3) {
    // Far zoom: just a dot
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, 3, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    return;
  }
  
  if (zoom < 0.6) {
    // Medium zoom: circle + short label
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    // ... draw truncated label
    return;
  }
  
  // Close zoom: full rendering with full title
  // ...
}
```

### Transform Memoization
```typescript
// Use useMemo with stable reference for tree structure
const treeStructureKey = useMemo(() => 
  JSON.stringify(tree.map(n => ({ id: n.id, parentId: n.parent_id, children: n.children?.map(c => c.id) }))),
  [tree]
);

const graphData = useMemo(() => 
  pageTreeToGraph(tree, options), 
  [treeStructureKey, options.colorMode, calendars]
);
```

### Debounced Layout Restart
```typescript
// When tree data changes, debounce worker restart
const debouncedRestart = useMemo(
  () => debounce((nodes, links) => {
    workerRef.current?.postMessage({ type: 'update', nodes, links });
  }, 300),
  []
);

useEffect(() => {
  debouncedRestart(graphData.nodes, graphData.links);
}, [graphData, debouncedRestart]);
```

## Dependencies
- Requires: `phase4-15-graph-renderer` (renderer integration)
- Requires: `d3-force` in worker (bundle separately)

## Testing
- Performance test: 1000 nodes, measure frame time (Chrome DevTools Performance)
- Unit test: Viewport culling returns correct subset
- Unit test: LOD renders correct detail at each zoom level
- Unit test: Transform memoization prevents recompute on unrelated changes
- Memory test: Start/stop simulation 100x → no memory growth

## Related
- `phase4-15-graph-renderer` — Renderer
- `phase4-16-graph-ui` — UI