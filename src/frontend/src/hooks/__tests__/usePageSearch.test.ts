/**
 * usePageSearch Hook Tests
 *
 * Covers debounced searching, stale-response cancellation, the recent-pages
 * fallback, breadcrumb computation, and empty-query handling.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { EntityId, Page, PageSearchResult, PageTreeNode } from '@backend/shared/types';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPage } from '../../../test/test-utils';
import { usePageSearch } from '../usePageSearch';

function page(id: string, overrides: Partial<Page> = {}): Page {
  return createMockPage({ id: id as EntityId, title: id, ...overrides });
}

function makeResult(pageIn: Page, rank = 0, snippet = ''): PageSearchResult {
  return { page: pageIn, rank, snippet };
}

/** root -> [child] -> grandchild, plus a standalone sibling. */
function sampleTree(): PageTreeNode[] {
  const root = page('root');
  const child = page('child', { parentId: 'root' as EntityId });
  const grandchild = page('grandchild', { parentId: 'child' as EntityId });
  const sibling = page('sibling', {
    updatedAt: new Date(Date.now() + 1000).toISOString() as Page['updatedAt'],
  });
  return [
    { page: root, children: [{ page: child, children: [{ page: grandchild, children: [] }] }] },
    { page: sibling, children: [] },
  ];
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let dbChangedCallback: ((payload: IpcEvents['db:changed']) => void) | null = null;
const searchMock = vi.fn<() => Promise<{ ok: boolean; data: PageSearchResult[] }>>();
const treeMock = vi.fn<() => Promise<{ ok: boolean; data: PageTreeNode[] }>>();

const mockApi = {
  db: {
    pages: {
      search: searchMock,
      tree: treeMock,
    },
  },
  onDbChanged: vi.fn((callback: (payload: IpcEvents['db:changed']) => void) => {
    dbChangedCallback = callback;
    return () => {
      dbChangedCallback = null;
    };
  }),
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true });

describe('usePageSearch', () => {
  beforeEach(() => {
    dbChangedCallback = null;
    searchMock.mockReset();
    treeMock.mockReset();
    treeMock.mockResolvedValue({ ok: true, data: sampleTree() });
    mockApi.onDbChanged.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('debounces queries so rapid typing fires a single search', async () => {
    vi.useFakeTimers();
    searchMock.mockResolvedValue({ ok: true, data: [makeResult(page('child'))] });
    const { result: hook } = renderHook(() => usePageSearch());

    await act(async () => {
      hook.current.setQuery('a');
      hook.current.setQuery('ab');
      hook.current.setQuery('abc');
      await vi.advanceTimersByTimeAsync(149);
    });
    expect(searchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith({ query: 'abc', limit: 20 });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
  });

  it('drops stale responses from cancelled in-flight searches', async () => {
    vi.useFakeTimers();
    const first = deferred<{ ok: boolean; data: PageSearchResult[] }>();
    const second = deferred<{ ok: boolean; data: PageSearchResult[] }>();
    searchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result: hook } = renderHook(() => usePageSearch());

    await act(async () => {
      hook.current.setQuery('a');
      await vi.advanceTimersByTimeAsync(160);
    });
    await act(async () => {
      hook.current.setQuery('ab');
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);

    // Resolve the NEWEST search first, then the stale one later.
    await act(async () => {
      second.resolve({ ok: true, data: [makeResult(page('fresh'))] });
      await Promise.resolve();
    });
    await act(async () => {
      first.resolve({ ok: true, data: [makeResult(page('stale'))] });
      await Promise.resolve();
    });

    expect(hook.current.results).toHaveLength(1);
    expect(hook.current.results[0]?.page.id).toBe('fresh');
  });

  it('keeps results empty for an empty query', async () => {
    const { result: hook } = renderHook(() => usePageSearch());
    await act(async () => {
      hook.current.setQuery('');
    });
    expect(searchMock).not.toHaveBeenCalled();
    expect(hook.current.hasQuery).toBe(false);
    expect(hook.current.results).toEqual([]);
  });

  it('loads recent pages and computes breadcrumbs from the catalog', async () => {
    const { result: hook } = renderHook(() => usePageSearch());

    await act(async () => {
      await hook.current.loadCatalog();
    });

    // Most recently updated first (sibling), then the rest.
    expect(hook.current.recentPages[0]?.id).toBe('sibling');
    expect(hook.current.recentPages).toHaveLength(4);

    const grandchildPage = hook.current.recentPages.find((p) => p.id === 'grandchild');
    expect(grandchildPage).toBeDefined();
    expect(hook.current.breadcrumbsOf(grandchildPage as Page)).toEqual(['root', 'child']);
  });

  it('reloads the catalog when a pages db:changed event fires', async () => {
    const { result: hook } = renderHook(() => usePageSearch());
    await act(async () => {
      await hook.current.loadCatalog();
    });
    expect(treeMock).toHaveBeenCalledTimes(1);

    const fresh = { ok: true, data: [{ page: page('x'), children: [] }] };
    treeMock.mockResolvedValue(fresh);
    expect(dbChangedCallback).not.toBeNull();
    await act(async () => {
      dbChangedCallback?.({ table: 'pages', action: 'update', id: 'child' });
    });
    await waitFor(() => {
      expect(treeMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(hook.current.recentPages).toHaveLength(1);
      expect(hook.current.recentPages[0]?.id).toBe('x');
    });
  });
});