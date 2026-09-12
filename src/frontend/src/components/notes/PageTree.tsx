/**
 * PageTree — Page Tree Rendering Component
 *
 * Renders the page tree as a flattened, depth-indented list so that
 * drag-and-drop reordering/nesting and keyboard navigation work across
 * all levels with a single SortableContext.
 *
 * @module @frontend/components/notes/PageTree
 */

import type { EntityId, PageTreeNode as PageTreeNodeModel } from '@backend/shared/types';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { usePageActions } from '../../hooks/usePageActions';
import { usePageTree, useExpandedState } from '../../hooks/usePageTree';
import { useNotesStore, selectActivePageId, selectPageMap } from '../../stores/notesStore';
import {
  calculateDropPosition,
  calculateNewPosition,
  isValidDropPosition,
} from '../../utils/dnd';
import type { DropPosition, TreeNavDirection } from '../../utils/dnd';

import { PageTreeNode } from './PageTreeNode';
import './PageTree.css';

interface PageTreeProps {
  /** Callback when a page is selected */
  onSelect: (pageId: EntityId) => void;
  /** Optional: initial focused node ID */
  initialFocusId?: EntityId | null;
}

interface VisibleNode {
  node: PageTreeNodeModel;
  depth: number;
  /** 1-based index among siblings */
  posInSet: number;
  /** Number of siblings */
  setSize: number;
}

/**
 * Compute the next focus target for a keyboard navigation step.
 * Returns the same id to signal "expand/collapse" for left/right.
 */
function navigateFocused(
  currentId: EntityId,
  visible: VisibleNode[],
  direction: TreeNavDirection,
  expanded: Set<EntityId>,
): EntityId {
  const idx = visible.findIndex((v) => v.node.page.id === currentId);
  const current = idx === -1 ? null : visible[idx]?.node;
  if (!current) return currentId;

  switch (direction) {
    case 'up': {
      return idx > 0 ? (visible[idx - 1]?.node.page.id ?? currentId) : currentId;
    }
    case 'down': {
      return idx < visible.length - 1 ? (visible[idx + 1]?.node.page.id ?? currentId) : currentId;
    }
    case 'left': {
      // Collapse if expanded, otherwise move to parent.
      if (expanded.has(currentId) && current.children.length > 0) return currentId;
      return current.page.parentId ?? currentId;
    }
    case 'right': {
      // Expand if collapsed & has children, otherwise move to first child.
      if (current.children.length > 0 && !expanded.has(currentId)) return currentId;
      return current.children[0]?.page.id ?? currentId;
    }
    default: {
      return currentId;
    }
  }
}

export function PageTree({ onSelect, initialFocusId = null }: PageTreeProps): JSX.Element {
  const { tree, isLoading, error, refetch } = usePageTree();
  const { expanded, isExpanded, toggleExpanded } = useExpandedState();
  const activePageId = useNotesStore(selectActivePageId);
  const pageMap = useNotesStore(selectPageMap);
  const getDescendantIds = useNotesStore((s) => s.getDescendantIds);
  const { movePage, createPage } = usePageActions();
  const { startDrag, updateDragHover, endDrag } = useNotesStore(
    useShallow((s) => ({
      startDrag: s.startDrag,
      updateDragHover: s.updateDragHover,
      endDrag: s.endDrag,
    })),
  );

  const [focusedId, setFocusedId] = useState<EntityId | null>(initialFocusId);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRectsRef = useRef<Map<EntityId, DOMRect>>(new Map());
  const shouldFocusRef = useRef(false);
  const dragRef = useRef<{
    id: EntityId | null;
    parentId: EntityId | null;
    startClientY: number;
    overId: EntityId | null;
    position: 'before' | 'after' | 'inside';
    isKeyboard: boolean;
  }>({
    id: null,
    parentId: null,
    startClientY: 0,
    overId: null,
    position: 'after',
    isKeyboard: false,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Flatten the tree into visible nodes (respecting expanded state).
  const visibleNodes = useMemo<VisibleNode[]>(() => {
    const result: VisibleNode[] = [];
    const walk = (nodes: PageTreeNodeModel[], depth: number): void => {
      nodes.forEach((node, index) => {
        result.push({ node, depth, posInSet: index + 1, setSize: nodes.length });
        if (node.children.length > 0 && isExpanded(node.page.id)) {
          walk(node.children, depth + 1);
        }
      });
    };
    walk(tree, 0);
    return result;
  }, [tree, isExpanded]);

  // Ordered sibling ids under a given parent (for drop index math).
  const getSiblingIds = useCallback(
    (parentId: EntityId | null): EntityId[] => {
      if (parentId === null) {
        return Object.values(pageMap)
          .filter((n) => n.parentId === null)
          .sort((a, b) => a.page.position - b.page.position)
          .map((n) => n.page.id);
      }
      return pageMap[parentId]?.children ?? [];
    },
    [pageMap],
  );

  // Whether a drop would create a valid tree (no self / descendant nesting).
  const isValidDrop = useCallback(
    (dragId: EntityId, targetId: EntityId, position: DropPosition): boolean =>
      isValidDropPosition(
        dragId,
        targetId,
        position,
        getDescendantIds,
        (id) => pageMap[id]?.parentId ?? null,
      ),
    [getDescendantIds, pageMap],
  );

  // Record rendered node rects so drop position can be computed from the pointer.
  const registerNodeRect = useCallback((id: EntityId, rect: DOMRect | null) => {
    if (rect) {
      nodeRectsRef.current.set(id, rect);
    } else {
      nodeRectsRef.current.delete(id);
    }
  }, []);

  // Auto-focus the active page on first mount.
  useEffect(() => {
    if (activePageId && !focusedId) {
      setFocusedId(activePageId);
    }
  }, [activePageId, focusedId]);

  // Ensure ancestors of the focused node are expanded.
  useEffect(() => {
    if (!focusedId) return;
    const walk = (nodes: PageTreeNodeModel[]): boolean => {
      for (const node of nodes) {
        if (node.page.id === focusedId) return true;
        if (node.children.length > 0 && walk(node.children)) {
          if (!isExpanded(node.page.id)) toggleExpanded(node.page.id);
          return true;
        }
      }
      return false;
    };
    walk(tree);
  }, [focusedId, tree, isExpanded, toggleExpanded]);

  const handleNavigate = useCallback(
    (direction: TreeNavDirection) => {
      if (!focusedId) return;
      const next = navigateFocused(focusedId, visibleNodes, direction, expanded);
      if (next !== focusedId) {
        shouldFocusRef.current = true;
        setFocusedId(next);
      }
    },
    [focusedId, visibleNodes, expanded],
  );

  // Move real DOM focus to the row keyboard navigation selected.
  useEffect(() => {
    if (!shouldFocusRef.current || !focusedId) return;
    shouldFocusRef.current = false;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-page-id="${focusedId}"]`);
    el?.focus();
  }, [focusedId]);

  const handleFocusChange = useCallback((nodeId: EntityId | null) => {
    setFocusedId(nodeId);
  }, []);

  const handleCreateFirstPage = useCallback(() => {
    void createPage({ parentId: null, title: 'New Page', icon: '📄' }).then((result) => {
      if (result.ok) {
        onSelect(result.data.id);
      }
    });
  }, [createPage, onSelect]);

  // -- Drag handlers ---------------------------------------------------------------

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as EntityId;
      if (!pageMap[id]) return;
      startDrag(id);
      const activator = event.activatorEvent as PointerEvent | KeyboardEvent;
      dragRef.current = {
        id,
        parentId: pageMap[id]?.parentId ?? null,
        startClientY: typeof (activator as PointerEvent).clientY === 'number' ? (activator as PointerEvent).clientY : 0,
        overId: null,
        position: 'after',
        isKeyboard: activator instanceof KeyboardEvent,
      };
    },
    [pageMap, startDrag],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const drag = dragRef.current;
      if (!drag.id || !event.over) return;
      const overId = event.over.id as EntityId;
      const clientY = drag.startClientY + event.delta.y;
      const rect = nodeRectsRef.current.get(overId);
      const position: DropPosition = drag.isKeyboard
        ? event.delta.y < 0
          ? 'before'
          : 'after'
        : rect
          ? calculateDropPosition(
              { clientY },
              rect,
              pageMap[overId]?.depth ?? 0,
              pageMap[drag.id]?.depth ?? 0,
            )
          : 'after';

      if (!isValidDrop(drag.id, overId, position)) {
        updateDragHover(null, null);
        drag.overId = null;
        return;
      }
      drag.overId = overId;
      drag.position = position;
      updateDragHover(overId, position);
    },
    [isValidDrop, updateDragHover, pageMap],
  );

  const handleDragEnd = useCallback(() => {
    const { id, overId, position } = dragRef.current;
    endDrag();
      dragRef.current = {
        id: null,
        parentId: null,
        startClientY: 0,
        overId: null,
        position: 'after',
        isKeyboard: false,
      };
    if (!id || !overId || id === overId) return;
    if (!isValidDrop(id, overId, position)) return;

    // Dropping in the middle of a row nests it as the first child.
    if (position === 'inside') {
      void movePage(id, overId, 0);
      return;
    }

    const siblingParent = pageMap[overId]?.parentId ?? null;
    const siblings = getSiblingIds(siblingParent);
    const idx = siblings.indexOf(overId);
    const newPosition = calculateNewPosition(position, Math.max(0, idx), siblings.length);
    void movePage(id, siblingParent, Math.max(0, newPosition));
  }, [endDrag, isValidDrop, movePage, pageMap, getSiblingIds]);

  const handleDragCancel = useCallback(() => {
    endDrag();
    dragRef.current = {
      id: null,
      parentId: null,
      startClientY: 0,
      overId: null,
      position: 'after',
      isKeyboard: false,
    };
  }, [endDrag]);

  if (isLoading) {
    return (
      <div className="page-tree page-tree--loading" role="tree" aria-label="Pages" aria-busy="true">
        <div className="page-tree__skeleton">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="page-tree__skeleton-item" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-tree page-tree--error" role="alert">
        <div className="page-tree__error">
          <span className="page-tree__error-icon" aria-hidden="true">⚠️</span>
          <span className="page-tree__error-text">Failed to load pages</span>
          <button className="page-tree__retry-btn" onClick={() => void refetch()} type="button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="page-tree page-tree--empty" role="tree" aria-label="Pages">
        <div className="page-tree__empty">
          <span className="page-tree__empty-icon" aria-hidden="true">📝</span>
          <p className="page-tree__empty-text">No pages yet</p>
          <p className="page-tree__empty-hint">Create your first page to get started</p>
          <button type="button" className="page-tree__empty-cta" onClick={handleCreateFirstPage}>
            Create your first page
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={visibleNodes.map((v) => v.node.page.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={containerRef} className="page-tree" role="tree" aria-label="Pages">
          {visibleNodes.map(({ node, depth, posInSet, setSize }) => (
            <PageTreeNode
              key={node.page.id}
              node={node}
              depth={depth}
              posInSet={posInSet}
              setSize={setSize}
              focusedId={focusedId}
              onFocusChange={handleFocusChange}
              onSelect={(pageId) => {
                setFocusedId(pageId);
                onSelect(pageId);
              }}
              onNavigate={handleNavigate}
              onMeasure={registerNodeRect}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}