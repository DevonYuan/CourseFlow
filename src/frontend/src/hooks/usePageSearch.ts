/**
 * usePageSearch — Search state management for pages
 *
 * Encapsulates the search lifecycle used by both the command palette and the
 * dedicated results page: debounced queries, stale-response cancellation,
 * recent-page fallback, and breadcrumb computation from the page tree.
 *
 * The backend search IPC is debounced ~150ms. Because the preload bridge does
 * not thread an AbortController through to `invoke`, cancellation is done with
 * a monotonic sequence guard — any response that no longer matches the latest
 * issued query is dropped, which gives the same user-visible behaviour as
 * aborting the in-flight request.
 *
 * @module @frontend/hooks/usePageSearch
 */

import type { EntityId, Page, PageTreeNode, PageSearchResult } from '@backend/shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';

/** How many results the palette requests from the backend. */
const DEFAULT_LIMIT = 20;
/** Debounce delay (ms) before an IPC search is issued. */
const DEBOUNCE_MS = 150;
/** Max number of recent pages shown when the query is empty. */
const RECENT_LIMIT = 10;

function flattenTree(nodes: PageTreeNode[]): Page[] {
  const flat: Page[] = [];
  const walk = (items: PageTreeNode[]): void => {
    for (const node of items) {
      flat.push(node.page);
      walk(node.children);
    }
  };
  walk(nodes);
  return flat;
}

export interface PageSearchState {
  /** Current raw query text (may contain leading/trailing whitespace). */
  query: string;
  /** Ranked results for the current query (empty when no query). */
  results: PageSearchResult[];
  /** Recently-updated pages shown when the query is empty. */
  recentPages: Page[];
  /** Whether an IPC search is currently awaiting a response. */
  isSearching: boolean;
  /** Human-readable error if the last search failed. */
  error: string | null;
  /** Index of the actively (keyboard) selected result. */
  selectedIndex: number;
  /** Convenience: is the query non-empty? */
  hasQuery: boolean;
  /** Combined list for rendering (recent pages when empty, else results). */
  items: Array<{ page: Page; snippet: string }>;
  /** Number of items in the combined list. */
  itemCount: number;
  /** Update the query (debounced search). */
  setQuery: (value: string) => void;
  /** Immediate search, bypassing the debounce. */
  runSearch: (raw: string) => Promise<void>;
  /** Load the page tree (catalog) — used for recent pages + breadcrumbs. */
  loadCatalog: () => Promise<void>;
  /** Reset all search state back to defaults. */
  reset: () => void;
  /** Move the keyboard selection by ±1 (wraps around). */
  move: (direction: 1 | -1) => void;
  /** Ancestor page titles of a page, top-of-tree first (excludes the page). */
  breadcrumbsOf: (page: Page) => string[];
  /** True once the page-tree catalog has been fetched (recent + breadcrumbs). */
  catalogLoaded: boolean;
}

/**
 * Creates the search state hook.
 * @param limit - Maximum results returned per query (default 20).
 */
export function usePageSearch(limit: number = DEFAULT_LIMIT): PageSearchState {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<PageSearchResult[]>([]);
  const [recentPages, setRecentPages] = useState<Page[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  /** Flat page map for breadcrumb + recent-page lookups. */
  const catalogRef = useRef<Map<EntityId, Page>>(new Map());
  /** Monotonic sequence — bumps on every query so stale responses are dropped. */
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limitRef = useRef(limit);

  const hasQuery = query.trim() !== '';
  const items: Array<{ page: Page; snippet: string }> = hasQuery
    ? results.map((r) => ({ page: r.page, snippet: r.snippet }))
    : recentPages.map((p) => ({ page: p, snippet: '' }));
  const itemCount = items.length;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSearch = useCallback(async (raw: string): Promise<void> => {
    const trimmed = raw.trim();
    if (!trimmed) {
      seqRef.current += 1;
      clearTimer();
      setResults([]);
      setIsSearching(false);
      setError(null);
      setSelectedIndex(0);
      return;
    }

    const seq = ++seqRef.current;
    setIsSearching(true);
    setError(null);
    const res = await window.api.db.pages.search({
      query: trimmed,
      limit: limitRef.current,
    });
    // Drop stale responses that no longer correspond to the latest query.
    if (seq !== seqRef.current) return;
    setIsSearching(false);
    if (res.ok) {
      setResults(res.data);
      setSelectedIndex(0);
    } else {
      setError(res.error ?? 'Search failed');
      setResults([]);
    }
  }, [clearTimer]);

  const setQuery = useCallback(
    (value: string): void => {
      setQueryState(value);
      setSelectedIndex(0);
      clearTimer();
      const trimmed = value.trim();
      if (!trimmed) {
        seqRef.current += 1;
        setResults([]);
        setIsSearching(false);
        setError(null);
        return;
      }
      setIsSearching(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSearch(trimmed);
      }, DEBOUNCE_MS);
    },
    [clearTimer, runSearch],
  );

  const loadCatalog = useCallback(async (): Promise<void> => {
    const res = await window.api.db.pages.tree();
    if (!res.ok) return;
    const flat = flattenTree(res.data);
    catalogRef.current = new Map(flat.map((p) => [p.id, p]));
    setCatalogLoaded(true);
    const recent = [...flat]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, RECENT_LIMIT);
    setRecentPages(recent);
  }, []);

  const reset = useCallback((): void => {
    clearTimer();
    seqRef.current += 1;
    setQueryState('');
    setResults([]);
    setRecentPages([]);
    setError(null);
    setSelectedIndex(0);
  }, [clearTimer]);

  const move = useCallback(
    (direction: 1 | -1): void => {
      setSelectedIndex((current) => {
        if (itemCount === 0) return -1;
        return (current + direction + itemCount) % itemCount;
      });
    },
    [itemCount],
  );

  const breadcrumbsOf = useCallback((page: Page): string[] => {
    const parts: string[] = [];
    let parentId = page.parentId ?? null;
    let guard = 0;
    while (parentId) {
      const parent = catalogRef.current.get(parentId);
      if (!parent) break;
      parts.push(parent.title);
      parentId = parent.parentId ?? null;
      guard += 1;
      if (guard > 50) break; // safety valve against malformed circular trees
    }
    return parts.reverse();
  }, []);

  // Invalidate cached catalog when the pages table changes.
  useEffect(() => {
    return window.api.onDbChanged?.((payload) => {
      if (payload.table === 'pages') {
        setCatalogLoaded(false);
        void loadCatalog();
      }
    });
  }, [loadCatalog]);

  // Clean up any pending debounce timer on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  return {
    query,
    results,
    recentPages,
    isSearching,
    error,
    selectedIndex,
    hasQuery,
    items,
    itemCount,
    setQuery,
    runSearch,
    loadCatalog,
    reset,
    move,
    breadcrumbsOf,
    catalogLoaded,
  };
}