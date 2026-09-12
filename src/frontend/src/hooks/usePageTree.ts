/**
 * usePageTree Hook — Page Tree Data Loading & Live Updates
 *
 * Custom hook for fetching the page tree via IPC, subscribing to db:changed
 * events, and managing expanded state persistence.
 *
 * @module @frontend/hooks/usePageTree
 */

import type { EntityId, PageTreeNode } from '@backend/shared/types';
import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';

import { useNotesStore } from '../stores/notesStore';

interface UsePageTreeReturn {
  /** Current page tree */
  tree: PageTreeNode[];
  /** Whether the initial tree fetch is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a tree refetch */
  refetch: () => Promise<void>;
}

/**
 * Custom hook for page tree operations.
 * Handles initial fetch, live updates via db:changed, and expanded state.
 */
export function usePageTree(): UsePageTreeReturn {
  const {
    tree,
    isLoading,
    error,
    setTree,
    setLoading,
    setError,
    handleDbChanged,
  } = useNotesStore(
    useShallow((state) => ({
      tree: state.tree,
      isLoading: state.isLoading,
      error: state.error,
      setTree: state.setTree,
      setLoading: state.setLoading,
      setError: state.setError,
      handleDbChanged: state.handleDbChanged,
    })),
  );

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Fetch the page tree from the backend.
   */
  const fetchTree = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.api.db.pages.tree();
      if (!isMountedRef.current) return;

      if (result.ok) {
        setTree(result.data);
      } else {
        setError(result.error || 'Failed to load page tree');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown error loading page tree');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [setLoading, setError, setTree]);

  /**
   * Subscribe to db:changed events for live updates.
   */
  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    void fetchTree();

    // Subscribe to database changes
    const unsubscribe = window.api.onDbChanged((payload) => {
      if (!isMountedRef.current) return;
      handleDbChanged(payload);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      isMountedRef.current = false;
      unsubscribeRef.current?.();
    };
  }, [fetchTree, handleDbChanged]);

  // Restore expanded state from localStorage on initial load
  // This is handled by the store's persist middleware, but we ensure
  // the Set is properly initialized after hydration
  useEffect(() => {
    // The persist middleware handles this, but we can add any
    // post-hydration logic here if needed
  }, []);

  // Restore expanded state from localStorage on initial load
  // This is handled by the store's persist middleware, but we ensure
  // the Set is properly initialized after hydration
  useEffect(() => {
    // The persist middleware handles this, but we can add any
    // post-hydration logic here if needed
  }, []);

  return {
    tree,
    isLoading,
    error,
    refetch: fetchTree,
  };
}

/**
 * Hook for getting expanded state and toggle function.
 */
export function useExpandedState(): {
  expanded: Set<EntityId>;
  isExpanded: (id: EntityId) => boolean;
  toggleExpanded: (id: EntityId) => void;
} {
  const { expanded, toggleExpanded } = useNotesStore(
    useShallow((state) => ({
      expanded: state.expanded,
      toggleExpanded: state.toggleExpanded,
    })),
  );

  const isExpanded = useCallback(
    (id: EntityId) => expanded.has(id),
    [expanded],
  );

  return { expanded, isExpanded, toggleExpanded };
}