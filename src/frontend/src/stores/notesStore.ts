/**
 * Notes Store — Zustand
 *
 * Centralized state management for the Notes workspace sidebar.
 * Handles page tree, expanded/collapsed state, active page, and DnD state.
 * Persists expanded state to localStorage.
 *
 * @module @frontend/stores/notesStore
 */

import type { IpcEvents } from '@backend/shared/ipc';
import type { EntityId, Page, PageTreeNode } from '@backend/shared/types';
import { create } from 'zustand';

/**
 * Flattened page map for quick lookups during DnD operations.
 */
export interface PageMap {
  [id: string]: {
    page: Page;
    children: EntityId[];
    parentId: EntityId | null;
    depth: number;
  };
}

interface NotesState {
  /** Hierarchical page tree from db:pages:tree */
  tree: PageTreeNode[];
  /** Flattened map for quick lookups */
  pageMap: PageMap;
  /** Set of expanded page IDs (persisted to localStorage) */
  expanded: Set<EntityId>;
  /** Currently active page ID (matches /notes/:pageId route) */
  activePageId: EntityId | null;
  /** Whether initial tree fetch is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Drag-and-drop state */
  dragState: {
    /** ID of the page being dragged */
    draggingId: EntityId | null;
    /** IDs of pages that are valid drop targets (not self or descendants) */
    validDropTargets: Set<EntityId>;
    /** Drop position indicator: 'before' | 'after' | 'inside' */
    dropPosition: 'before' | 'after' | 'inside' | null;
    /** Target page ID for the drop */
    dropTargetId: EntityId | null;
  };
  /** Inline rename state */
  renameState: {
    /** Page ID being renamed */
    renamingId: EntityId | null;
    /** Current input value */
    inputValue: string;
  };
}

interface NotesActions {
  /** Set the full page tree and rebuild page map */
  setTree: (tree: PageTreeNode[]) => void;
  /** Toggle expanded/collapsed state for a page */
  toggleExpanded: (pageId: EntityId) => void;
  /** Set expanded state for multiple pages (e.g., on initial load) */
  setExpanded: (expanded: Set<EntityId>) => void;
  /** Set the active page ID */
  setActivePage: (pageId: EntityId | null) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Handle db:changed event for pages table */
  handleDbChanged: (payload: IpcEvents['db:changed']) => void;
  /** Optimistically apply a page move (reorder/nest/unnest) */
  optimisticMove: (pageId: EntityId, newParentId: EntityId | null, newPosition: number) => void;
  /** Revert optimistic move on IPC error */
  revertMove: () => void;
  /** Optimistically create a new page */
  optimisticCreate: (page: Page, parentId: EntityId | null) => void;
  /** Optimistically update a page (rename, icon, etc.) */
  optimisticUpdate: (pageId: EntityId, updates: Partial<Page>) => void;
  /** Optimistically delete a page and all descendants */
  optimisticDelete: (pageId: EntityId) => void;
  /** Start dragging a page */
  startDrag: (pageId: EntityId) => void;
  /** Update drag hover state */
  updateDragHover: (targetId: EntityId | null, position: 'before' | 'after' | 'inside' | null) => void;
  /** End drag operation */
  endDrag: () => void;
  /** Start inline rename */
  startRename: (pageId: EntityId, currentTitle: string) => void;
  /** Cancel inline rename */
  cancelRename: () => void;
  /** Commit inline rename */
  commitRename: () => void;
  /** Get all descendant IDs of a page (for circular ref prevention) */
  getDescendantIds: (pageId: EntityId) => EntityId[];
  /** Check if a page can be dropped into another */
  canDropInto: (dragId: EntityId, targetId: EntityId) => boolean;
}

/**
 * Rebuild page map from tree for quick lookups.
 */
function buildPageMap(tree: PageTreeNode[], parentId: EntityId | null = null, depth = 0): PageMap {
  const map: PageMap = {};

  function traverse(nodes: PageTreeNode[], currentParent: EntityId | null, currentDepth: number) {
    for (const node of nodes) {
      map[node.page.id] = {
        page: node.page,
        children: node.children.map((c) => c.page.id),
        parentId: currentParent,
        depth: currentDepth,
      };
      traverse(node.children, node.page.id, currentDepth + 1);
    }
  }

  traverse(tree, parentId, depth);
  return map;
}

/**
 * Get all descendant IDs recursively from page map.
 */
function getAllDescendants(pageMap: PageMap, pageId: EntityId): EntityId[] {
  const descendants: EntityId[] = [];
  const node = pageMap[pageId];
  if (!node) return descendants;

  for (const childId of node.children) {
    descendants.push(childId, ...getAllDescendants(pageMap, childId));
  }
  return descendants;
}

/** localStorage key for expanded state persistence */
const EXPANDED_STORAGE_KEY = 'courseflow:notes:expanded';

/**
 * Read the persisted `expanded` page ids, falling back to an empty set when
 * localStorage is unavailable (private mode / non-browser environments).
 */
function readExpandedFromStorage(): Set<EntityId> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed as EntityId[]) : new Set();
  } catch {
    return new Set();
  }
}

/** Persist the expanded page ids, ignoring write failures. */
function writeExpandedToStorage(expanded: Set<EntityId>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expanded]));
  } catch {
    // Ignore quota / private-browsing errors — expanded state is non-critical.
  }
}

export const useNotesStore = create<NotesState & NotesActions>()((set, get) => ({
      // Initial state
      tree: [],
      pageMap: {},
      expanded: readExpandedFromStorage(),
      activePageId: null,
      isLoading: false,
      error: null,
      dragState: {
        draggingId: null,
        validDropTargets: new Set(),
        dropPosition: null,
        dropTargetId: null,
      },
      renameState: {
        renamingId: null,
        inputValue: '',
      },

      // Actions
      setTree: (tree) =>
        set({
          tree,
          pageMap: buildPageMap(tree),
        }),

      toggleExpanded: (pageId) =>
        set((state) => {
          const newExpanded = new Set(state.expanded);
          if (newExpanded.has(pageId)) {
            newExpanded.delete(pageId);
          } else {
            newExpanded.add(pageId);
          }
          writeExpandedToStorage(newExpanded);
          return { expanded: newExpanded };
        }),

      setExpanded: (expanded) => {
        writeExpandedToStorage(expanded);
        set({ expanded });
      },

      setActivePage: (pageId) => set({ activePageId: pageId }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      handleDbChanged: (payload) => {
        if (payload.table !== 'pages') return;

        const { tree, activePageId } = get();

        switch (payload.action) {
          case 'insert': {
            // Refetch tree for simplicity (MVP approach)
            // In future, could do optimistic insert with parent context
            void window.api.db.pages.tree().then((result) => {
              if (result.ok) {
                get().setTree(result.data);
              }
            });
            break;
          }
          case 'update': {
            // Update the specific page in tree
            const updatePageInTree = (
              nodes: PageTreeNode[],
            ): PageTreeNode[] =>
              nodes.map((node) => {
                if (node.page.id === payload.id) {
                  // We don't have the full updated page data, so refetch
                  // For MVP, refetch entire tree
                  void window.api.db.pages.tree().then((result) => {
                    if (result.ok) {
                      get().setTree(result.data);
                    }
                  });
                  return node;
                }
                return {
                  ...node,
                  children: updatePageInTree(node.children),
                };
              });

            set({ tree: updatePageInTree(tree) });
            break;
          }
          case 'delete': {
            // Remove page and descendants from tree
            const removePageFromTree = (
              nodes: PageTreeNode[],
            ): PageTreeNode[] =>
              nodes
                .filter((node) => node.page.id !== payload.id)
                .map((node) => ({
                  ...node,
                  children: removePageFromTree(node.children),
                }));

            const newTree = removePageFromTree(tree);
            set({
              tree: newTree,
              pageMap: buildPageMap(newTree),
              // If deleted page was active, clear active
              activePageId: activePageId === payload.id ? null : activePageId,
            });
            break;
          }
          case 'reorder': {
            // Page moved - refetch tree for correct structure
            void window.api.db.pages.tree().then((result) => {
              if (result.ok) {
                get().setTree(result.data);
              }
            });
            break;
          }
        }
      },

      optimisticMove: (pageId, newParentId, newPosition) => {
        const { tree } = get();

        // Recursively remove the dragged node from the tree.
        const removeNode = (
          nodes: PageTreeNode[],
        ): { nodes: PageTreeNode[]; removed: PageTreeNode | null } => {
          for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i] as PageTreeNode;
            if (node.page.id === pageId) {
              return {
                nodes: [...nodes.slice(0, i), ...nodes.slice(i + 1)],
                removed: node,
              };
            }
            const childResult = removeNode(node.children);
            if (childResult.removed) {
              const updated = { ...node, children: childResult.nodes };
              return {
                nodes: nodes.map((n, idx) => (idx === i ? updated : n)),
                removed: childResult.removed,
              };
            }
          }
          return { nodes, removed: null };
        };

        const { nodes: treeWithoutDrag, removed } = removeNode(tree);

        // Nothing moved (page not found).
        if (!removed) return;
        // `removed` is a const binding, so the null-narrowing is preserved in closures.
        const movedNode = removed;
        const targetPosition = Math.max(0, newPosition);

        const insertNode = (
          nodes: PageTreeNode[],
          targetParentId: EntityId | null,
        ): PageTreeNode[] => {
          if (targetParentId === null) {
            const next = [...nodes];
            next.splice(Math.min(targetPosition, next.length), 0, {
              ...movedNode,
              page: {
                ...movedNode.page,
                parentId: null,
                position: Math.min(targetPosition, next.length),
              },
            });
            return next;
          }
          return nodes.map((node) => {
            if (node.page.id === targetParentId) {
              const next = [...node.children];
              next.splice(Math.min(targetPosition, next.length), 0, {
                ...movedNode,
                page: {
                  ...movedNode.page,
                  parentId: targetParentId,
                  position: Math.min(targetPosition, next.length),
                },
              });
              return { ...node, children: next };
            }
            return { ...node, children: insertNode(node.children, targetParentId) };
          });
        };

        const newTree = insertNode(treeWithoutDrag, newParentId);
        set({ tree: newTree, pageMap: buildPageMap(newTree) });
      },

      revertMove: () => {
        // For MVP, refetch tree on error
        void window.api.db.pages.tree().then((result) => {
          if (result.ok) {
            get().setTree(result.data);
          }
        });
      },

      optimisticCreate: (page, parentId) => {
        const { tree } = get();

        const addPageToTree = (
          nodes: PageTreeNode[],
          targetParentId: EntityId | null,
        ): PageTreeNode[] => {
          if (targetParentId === null) {
            // Add as root
            return [
              ...nodes,
              {
                page: { ...page, parentId: null, position: nodes.length },
                children: [],
              },
            ];
          }

          return nodes.map((node) => {
            if (node.page.id === targetParentId) {
              return {
                ...node,
                children: [
                  ...node.children,
                  {
                    page: { ...page, parentId: targetParentId, position: node.children.length },
                    children: [],
                  },
                ],
              };
            }
            return {
              ...node,
              children: addPageToTree(node.children, targetParentId),
            };
          });
        };

        const newTree = addPageToTree(tree, parentId);
        set({ tree: newTree, pageMap: buildPageMap(newTree) });
      },

      optimisticUpdate: (pageId, updates) => {
        const { tree } = get();

        const updatePageInTree = (nodes: PageTreeNode[]): PageTreeNode[] =>
          nodes.map((node) => {
            if (node.page.id === pageId) {
              return {
                ...node,
                page: { ...node.page, ...updates },
              };
            }
            return {
              ...node,
              children: updatePageInTree(node.children),
            };
          });

        const newTree = updatePageInTree(tree);
        set({ tree: newTree, pageMap: buildPageMap(newTree) });
      },

      optimisticDelete: (pageId) => {
        const { tree, activePageId } = get();

        const removePageFromTree = (nodes: PageTreeNode[]): PageTreeNode[] =>
          nodes
            .filter((node) => node.page.id !== pageId)
            .map((node) => ({
              ...node,
              children: removePageFromTree(node.children),
            }));

        const newTree = removePageFromTree(tree);
        set({
          tree: newTree,
          pageMap: buildPageMap(newTree),
          activePageId: activePageId === pageId ? null : activePageId,
        });
      },

      startDrag: (pageId) => {
        const { pageMap } = get();
        const descendants = getAllDescendants(pageMap, pageId);
        const invalidTargets = new Set<EntityId>([pageId, ...descendants]);
        const allIds = Object.keys(pageMap) as EntityId[];
        const validTargets = new Set(allIds.filter((id) => !invalidTargets.has(id)));

        set({
          dragState: {
            draggingId: pageId,
            validDropTargets: validTargets,
            dropPosition: null,
            dropTargetId: null,
          },
        });
      },

      updateDragHover: (targetId, position) =>
        set((state) => ({
          dragState: {
            ...state.dragState,
            dropTargetId: targetId,
            dropPosition: position,
          },
        })),

      endDrag: () =>
        set({
          dragState: {
            draggingId: null,
            validDropTargets: new Set(),
            dropPosition: null,
            dropTargetId: null,
          },
        }),

      startRename: (pageId, currentTitle) =>
        set({
          renameState: {
            renamingId: pageId,
            inputValue: currentTitle,
          },
        }),

      cancelRename: () =>
        set({
          renameState: {
            renamingId: null,
            inputValue: '',
          },
        }),

      commitRename: () =>
        set({
          renameState: {
            renamingId: null,
            inputValue: '',
          },
        }),

      getDescendantIds: (pageId) => {
        const { pageMap } = get();
        return getAllDescendants(pageMap, pageId);
      },

      canDropInto: (dragId, targetId) => {
        const { pageMap } = get();
        if (dragId === targetId) return false;
        const descendants = getAllDescendants(pageMap, dragId);
        return !descendants.includes(targetId);
      },
    }));

/**
 * Selector for expanded state as a plain object (for non-react usage).
 */
export const selectExpanded = (state: NotesState & NotesActions): Set<EntityId> => state.expanded;

/**
 * Selector for active page ID.
 */
export const selectActivePageId = (state: NotesState & NotesActions): EntityId | null =>
  state.activePageId;

/**
 * Selector for the full tree.
 */
export const selectTree = (state: NotesState & NotesActions): PageTreeNode[] => state.tree;

/**
 * Selector for the flattened page map (fast lookups for DnD).
 */
export const selectPageMap = (state: NotesState & NotesActions): PageMap => state.pageMap;

/**
 * Selector for loading state.
 */
export const selectIsLoading = (state: NotesState & NotesActions): boolean => state.isLoading;

/**
 * Selector for error state.
 */
export const selectError = (state: NotesState & NotesActions): string | null => state.error;

/**
 * Selector for drag state.
 */
export const selectDragState = (state: NotesState & NotesActions): NotesState['dragState'] =>
  state.dragState;

/**
 * Selector for rename state.
 */
export const selectRenameState = (state: NotesState & NotesActions): NotesState['renameState'] =>
  state.renameState;