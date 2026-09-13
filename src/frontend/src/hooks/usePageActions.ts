/**
 * usePageActions Hook — Page CRUD Mutations with Optimistic Updates
 *
 * Custom hook wrapping IPC calls for page operations with optimistic UI updates
 * and rollback on failure. Surfaces IpcResult for callers to handle toasts.
 *
 * @module @frontend/hooks/usePageActions
 */

import type { IpcResult } from '@backend/shared/ipc';
import type { EntityId, IsoDateTime, Page, PageInput, PageUpdateInput, PageTreeNode } from '@backend/shared/types';
import { useCallback } from 'react';
import { useShallow } from 'zustand/shallow';

import { useToast } from '../context/ToastContext';
import { useNotesStore } from '../stores/notesStore';

interface UsePageActionsReturn {
  /** Create a new page */
  createPage: (input: PageInput) => Promise<IpcResult<Page>>;
  /** Update an existing page (rename, move, icon, etc.) */
  updatePage: (input: PageUpdateInput) => Promise<IpcResult<Page>>;
  /** Delete a page and all its descendants */
  deletePage: (pageId: EntityId) => Promise<IpcResult<void>>;
  /** Move a page to a new parent and/or position */
  movePage: (pageId: EntityId, parentId: EntityId | null, position: number) => Promise<IpcResult<Page>>;
  /** Duplicate a page and all its descendants (deep copy) */
  duplicatePage: (pageId: EntityId) => Promise<IpcResult<Page>>;
  /** Get a single page by ID */
  getPage: (pageId: EntityId) => Promise<IpcResult<Page | null>>;
}

/**
 * Generate a temporary ID for optimistic inserts.
 */
let tempPageCounter = 0;
function createTempPageId(): EntityId {
  tempPageCounter += 1;
  return `temp-page-${Date.now()}-${tempPageCounter}` as EntityId;
}

/**
 * Find a page node in the tree by ID.
 */
function findPageNode(tree: PageTreeNode[], pageId: EntityId): PageTreeNode | null {
  for (const node of tree) {
    if (node.page.id === pageId) return node;
    const found = findPageNode(node.children, pageId);
    if (found) return found;
  }
  return null;
}

/**
 * Custom hook for page mutation operations.
 */
export function usePageActions(): UsePageActionsReturn {
  const { optimisticCreate, optimisticUpdate, optimisticDelete, optimisticMove, revertMove, tree } =
    useNotesStore(
      useShallow((state) => ({
        optimisticCreate: state.optimisticCreate,
        optimisticUpdate: state.optimisticUpdate,
        optimisticDelete: state.optimisticDelete,
        optimisticMove: state.optimisticMove,
        revertMove: state.revertMove,
        tree: state.tree,
      })),
    );
  const { error: showErrorToast } = useToast();

  /**
   * Create a new page.
   */
  const createPage = useCallback(
    async (input: PageInput): Promise<IpcResult<Page>> => {
      // Optimistic create
      const tempId = createTempPageId();
      const now = new Date().toISOString() as IsoDateTime;
      const optimisticPage: Page = {
        id: tempId,
        parentId: input.parentId ?? null,
        title: input.title || 'Untitled',
        content: input.content ?? null,
        icon: input.icon ?? null,
        cover: input.cover ?? null,
        position: input.position ?? 0,
        createdAt: now,
        updatedAt: now,
        createdBy: null,
      };

      optimisticCreate(optimisticPage, input.parentId ?? null);

      try {
        const result = await window.api.db.pages.create(input);
        if (result.ok) {
          // Replace optimistic page with real page
          optimisticUpdate(tempId, { ...result.data, id: result.data.id });
        } else {
          // Rollback on failure
          optimisticDelete(tempId);
          showErrorToast('Failed to create page', {
            duration: 5000,
            action: {
              label: 'Retry',
              onClick: () => void createPage(input),
            },
          });
        }
        return result;
      } catch (err) {
        optimisticDelete(tempId);
        const error = err instanceof Error ? err.message : 'Unknown error creating page';
        showErrorToast(error);
        return { ok: false, error };
      }
    },
    [optimisticCreate, optimisticUpdate, optimisticDelete, showErrorToast],
  );

  /**
   * Update an existing page.
   */
  const updatePage = useCallback(
    async (input: PageUpdateInput): Promise<IpcResult<Page>> => {
      // Optimistic update
      const previousPage = findPageNode(tree, input.id)?.page;
      if (previousPage) {
        optimisticUpdate(input.id, input);
      }

      try {
        const result = await window.api.db.pages.update(input);
        if (!result.ok && previousPage) {
          // Rollback on failure
          optimisticUpdate(input.id, previousPage);
          showErrorToast('Failed to update page', {
            duration: 5000,
            action: {
              label: 'Retry',
              onClick: () => void updatePage(input),
            },
          });
        }
        return result;
      } catch (err) {
        if (previousPage) {
          optimisticUpdate(input.id, previousPage);
        }
        const error = err instanceof Error ? err.message : 'Unknown error updating page';
        showErrorToast(error);
        return { ok: false, error };
      }
    },
    [tree, optimisticUpdate, showErrorToast],
  );

  /**
   * Delete a page and all its descendants.
   */
  const deletePage = useCallback(
    async (pageId: EntityId): Promise<IpcResult<void>> => {
      // Optimistic delete
      optimisticDelete(pageId);

      try {
        const result = await window.api.db.pages.delete(pageId);
        if (!result.ok) {
          // Note: Can't easily rollback a delete without storing the subtree
          // For MVP, we rely on the live update to refetch the tree
          showErrorToast('Failed to delete page', {
            duration: 5000,
            action: {
              label: 'Retry',
              onClick: () => void deletePage(pageId),
            },
          });
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error deleting page';
        showErrorToast(error);
        return { ok: false, error };
      }
    },
    [optimisticDelete, showErrorToast],
  );

  /**
   * Move a page to a new parent and/or position.
   */
  const movePage = useCallback(
    async (pageId: EntityId, parentId: EntityId | null, position: number): Promise<IpcResult<Page>> => {
      // Optimistic move
      optimisticMove(pageId, parentId, position);

      try {
        const result = await window.api.db.pages.move({ id: pageId, parentId, position });
        if (!result.ok) {
          // Rollback on failure
          revertMove();
          showErrorToast('Failed to move page', {
            duration: 5000,
            action: {
              label: 'Retry',
              onClick: () => void movePage(pageId, parentId, position),
            },
          });
        }
        return result;
      } catch (err) {
        revertMove();
        const error = err instanceof Error ? err.message : 'Unknown error moving page';
        showErrorToast(error);
        return { ok: false, error };
      }
    },
    [optimisticMove, revertMove, showErrorToast],
  );

  /**
   * Duplicate a page and all its descendants (deep copy).
   *
   * Pages are created sequentially, parents before children, so each child is
   * created with the real id of its freshly-created parent. The tree is
   * refreshed by the `db:changed` events emitted by the backend.
   */
  const duplicatePage = useCallback(
    async (pageId: EntityId): Promise<IpcResult<Page>> => {
      const root = findPageNode(tree, pageId);
      if (!root) {
        return { ok: false, error: 'Page not found' };
      }

      // Pages created so far, for best-effort rollback on failure.
      const created: Page[] = [];

      const createSubtree = async (
        node: PageTreeNode,
        parentId: EntityId | null,
        isRoot: boolean,
      ): Promise<Page> => {
        const result = await window.api.db.pages.create({
          parentId,
          title: isRoot ? `Copy of ${node.page.title}` : node.page.title,
          content: node.page.content,
          icon: node.page.icon,
          cover: node.page.cover,
        });
        if (!result.ok) {
          throw new Error(result.error || 'Failed to create page');
        }
        created.push(result.data);
        for (const child of node.children) {
          await createSubtree(child, result.data.id, false);
        }
        return result.data;
      };

      try {
        const newRoot = await createSubtree(root, root.page.parentId ?? null, true);
        return { ok: true, data: newRoot };
      } catch (err) {
        // Best-effort rollback: delete whatever was created (children first),
        // so a partial duplicate never lingers in the tree.
        for (const page of [...created].reverse()) {
          await window.api.db.pages.delete(page.id);
        }
        showErrorToast('Failed to duplicate page', {
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => void duplicatePage(pageId),
          },
        });
        const error = err instanceof Error ? err.message : 'Unknown error duplicating page';
        return { ok: false, error };
      }
    },
    [tree, showErrorToast],
  );

  /**
   * Get a single page by ID.
   */
  const getPage = useCallback(
    async (pageId: EntityId): Promise<IpcResult<Page | null>> => {
      try {
        const result = await window.api.db.pages.get(pageId);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error getting page';
        showErrorToast(error);
        return { ok: false, error };
      }
    },
    [showErrorToast],
  );

  return {
    createPage,
    updatePage,
    deletePage,
    movePage,
    duplicatePage,
    getPage,
  };
}