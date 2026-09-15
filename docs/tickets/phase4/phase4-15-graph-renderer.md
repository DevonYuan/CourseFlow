# Ticket: phase4-15-graph-renderer

## Title
**Graph Renderer Component**

## Description
Use **D3.js force-directed** or **Cytoscape.js** or **React Flow** (evaluate bundle size). Canvas/WebGL for performance (>500 nodes). Features: pan/zoom, click node → navigate to page, hover → tooltip, drag to reposition (persist positions?). Color by depth or calendar.

## Acceptance Criteria
- [ ] Library selected and justified (bundle size, performance, features)
- [ ] Renderer component: `GraphRenderer.tsx` using Canvas (not SVG) for performance
- [ ] Force-directed layout (D3 `d3-force`) with configurable forces
- [ ] Pan/zoom: mouse wheel zoom, drag to pan, touch support
- [ ] Click node → navigate to `/notes/:pageId` (client-side router)
- [ ] Hover node → tooltip with title, depth, children count
- [ ] Drag node → reposition (optional: persist to `pages.graph_x`, `graph_y` — defer)
- [ ] Color by depth (default) or calendar (toggle)
- [ ] Legend component showing depth/calendar color mapping
- [ ] Performance: 60fps with 500+ nodes
- [ ] Reduced motion: disable physics animation when `prefers-reduced-motion`
- [ ] Accessibility: keyboard navigation (Tab/Arrows between nodes), ARIA labels

## Technical Details

### Library Evaluation
| Library | Bundle Size | Canvas Support | Force Layout | React Integration | Verdict |
|---------|-------------|----------------|--------------|-------------------|---------|
| `d3-force` + custom Canvas | ~30KB | ✅ Manual | ✅ Built-in | Manual | **Recommended** |
| `cytoscape` + `cytoscape-canvas` | ~200KB | ✅ | ✅ | Wrapper needed | Heavy |
| `reactflow` | ~150KB | ✅ | ❌ (dagre only) | Native | No force layout |
| `graphology` + `sigma.js` | ~100KB | ✅ WebGL | ✅ | Wrapper | Complex |

**Decision:** `d3-force` + custom Canvas renderer
- Smallest bundle
- Full control over rendering loop
- Force simulation runs in Web Worker (ticket 4.17)
- No React reconciliation overhead for 500+ nodes

### Implementation (Canvas + D3 Force)
```tsx
// GraphRenderer.tsx
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { useRef, useEffect, useState } from 'react';
import { GraphData, GraphNode, GraphLink } from '@/types/graph';

interface GraphRendererProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (node: GraphNode | null) => void;
  width: number;
  height: number;
}

export function GraphRenderer({ data, onNodeClick, onNodeHover, width, height }: GraphRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [simulation, setSimulation] = useState<any>(null);
  
  // Initialize simulation
  useEffect(() => {
    const sim = forceSimulation<GraphNode, GraphLink>(data.nodes)
      .force('link', forceLink<GraphNode, GraphLink>(data.links).id(d => d.id).distance(80))
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide().radius(d => 20 + d.title.length * 3).strength(0.8))
      .alphaDecay(0.02)
      .on('tick', () => {
        // Trigger re-render via state or direct canvas draw
        draw();
      });
    
    setSimulation(sim);
    return () => sim.stop();
  }, [data.nodes, data.links, width, height]);
  
  // Canvas drawing
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    
    // Draw links
    ctx.strokeStyle = 'var(--line-subtle)';
    ctx.lineWidth = 1;
    for (const link of data.links) {
      const source = link.source as GraphNode;
      const target = link.target as GraphNode;
      if (source.x && target.x) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    }
    
    // Draw nodes
    for (const node of data.nodes) {
      if (!node.x || !node.y) continue;
      const radius = Math.max(12, 8 + node.title.length * 1.5);
      
      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
      
      // Border for hover/selection
      if (node.isHovered) {
        ctx.strokeStyle = 'var(--accent)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Title text (truncated)
      ctx.fillStyle = 'var(--ink)';
      ctx.font = '11px var(--font-ui)';
      ctx.textAlign = 'center';
      const text = node.title.length > 18 ? node.title.slice(0, 18) + '…' : node.title;
      ctx.fillText(text, node.x, node.y + radius + 14);
    }
  };
  
  // Interaction handlers
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = findNodeAt(data.nodes, x, y);
    if (node) onNodeClick(node.id);
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = findNodeAt(data.nodes, x, y);
    onNodeHover(node || null);
    // Re-render for hover highlight
  };
  
  return (
    <canvas
      ref={canvasRef}
      width={width * devicePixelRatio}
      height={height * devicePixelRatio}
      style={{ width, height, cursor: 'grab' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onNodeHover(null)}
      role="img"
      aria-label="Notes hierarchy graph"
    />
  );
}

function findNodeAt(nodes: GraphNode[], x: number, y: number): GraphNode | null {
  // Check in reverse (top-most first)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (!node.x || !node.y) continue;
    const radius = Math.max(12, 8 + node.title.length * 1.5);
    const dx = node.x - x;
    const dy = node.y - y;
    if (dx * dx + dy * dy <= radius * radius) return node;
  }
  return null;
}
```

### Pan/Zoom
- Track `transform = { x, y, k }` (translate + scale)
- Apply to canvas context: `ctx.translate(x, y); ctx.scale(k, k);`
- Wheel event → zoom at cursor position
- Drag (on empty space) → pan
- Reset button: `transform = { x: 0, y: 0, k: 1 }`

## Dependencies
- Requires: `phase4-14-graph-types` (GraphData types)
- Requires: `d3-force` (`pnpm add d3-force @types/d3-force`)
- Requires: Phase 3 router for navigation

## Testing
- Component test: Renders nodes/links correctly
- Component test: Click → calls onNodeClick with correct ID
- Component test: Hover → calls onNodeHover
- Performance test: 500 nodes at 60fps (manual)
- Accessibility test: Keyboard navigation works

## Related
- `phase4-14-graph-types` — Data types
- `phase4-16-graph-ui` — Parent UI component
- `phase4-17-graph-perf` — Web Worker optimization