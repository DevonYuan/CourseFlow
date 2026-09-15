# Ticket: phase4-14-graph-types

## Title
**Graph Data Types**

## Description
Define `GraphNode` (id, title, color, depth, childrenCount), `GraphLink` (source, target). Transform `PageTreeNode[]` → node/link arrays for rendering.

## Acceptance Criteria
- [ ] Types defined in `src/backend/shared/types.ts` (or `src/frontend/src/types/graph.ts` if frontend-only):
  - `GraphNode` interface
  - `GraphLink` interface
  - `GraphData` interface (nodes + links)
- [ ] Transform function: `pageTreeToGraph(tree: PageTreeNode[]): GraphData`
- [ ] Node properties: id, title, color (by depth or calendar), depth, childrenCount, isExpanded
- [ ] Link properties: source, target, type ('parent-child')
- [ ] Color scheme: depth-based gradient (configurable)
- [ ] Unit tests for transform with various tree shapes

## Technical Details

### Types
```typescript
// If shared (backend + frontend): src/backend/shared/types.ts
// If frontend-only: src/frontend/src/types/graph.ts

export interface GraphNode {
  id: string;                    // Page.id
  title: string;                 // Page.title (truncated for display)
  color: string;                 // Hex color (depth-based or calendar-based)
  depth: number;                 // 0 = root, 1 = child, etc.
  childrenCount: number;         // Direct children count
  isExpanded?: boolean;          // For UI state sync
  x?: number;                    // Layout position (set by force sim)
  y?: number;
  vx?: number;                   // Velocity (for D3)
  vy?: number;
}

export interface GraphLink {
  source: string;                // Parent page ID
  target: string;                // Child page ID
  type: 'parent-child';          // Extensible for future link types
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
```

### Transform Function
```typescript
// src/frontend/src/utils/graphTransform.ts
import { PageTreeNode } from '@backend/shared/types';

interface TransformOptions {
  maxDepth?: number;           // Limit depth for performance
  colorScheme: 'depth' | 'calendar'; // Color by depth or calendar
  calendarColors?: Map<string, string>; // calendarId -> color
}

export function pageTreeToGraph(
  tree: PageTreeNode[], 
  options: TransformOptions = { colorScheme: 'depth' }
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  
  function traverse(node: PageTreeNode, depth: number, parentId: string | null) {
    if (options.maxDepth !== undefined && depth > options.maxDepth) return;
    
    // Determine color
    let color: string;
    if (options.colorScheme === 'calendar' && node.calendar_id && options.calendarColors) {
      color = options.calendarColors.get(node.calendar_id) || depthColor(depth);
    } else {
      color = depthColor(depth);
    }
    
    const graphNode: GraphNode = {
      id: node.id,
      title: node.title,
      color,
      depth,
      childrenCount: node.children?.length || 0,
      isExpanded: node.isExpanded,
    };
    
    nodes.push(graphNode);
    
    if (parentId) {
      links.push({ source: parentId, target: node.id, type: 'parent-child' });
    }
    
    if (node.children) {
      for (const child of node.children) {
        traverse(child, depth + 1, node.id);
      }
    }
  }
  
  for (const root of tree) {
    traverse(root, 0, null);
  }
  
  return { nodes, links };
}

// Depth-based color gradient
function depthColor(depth: number): string {
  const hues = [180, 210, 240, 270, 300, 330, 0, 30, 60]; // Teal → Blue → Purple → Pink → Red → Orange → Yellow → Green
  const hue = hues[depth % hues.length];
  return `hsl(${hue}, 65%, 45%)`;
}
```

### PageTreeNode Extension
- May need to add `calendar_id` to `PageTreeNode` in `src/backend/shared/types.ts` if coloring by calendar
- Or compute calendar from page's root ancestor

## Dependencies
- Requires: Phase 3 `PageTreeNode` type (existing)
- Requires: `calendarsStore` for calendar colors (if calendar-based coloring)

## Testing
- Unit test: Flat tree (all root) → correct nodes, no links
- Unit test: Deep tree (5 levels) → correct depths, links
- Unit test: Color by depth produces expected hues
- Unit test: Color by calendar uses calendar colors
- Unit test: MaxDepth limits nodes correctly

## Related
- `phase4-15-graph-renderer` — Consumes GraphData
- `phase4-16-graph-ui` — UI for graph view
- Phase 3 `pagesStore` / `notesStore` — Source of PageTreeNode