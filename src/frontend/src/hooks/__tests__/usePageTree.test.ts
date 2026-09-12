/**
 * usePageTree Hook Tests
 *
 * Covers initial fetch, error surfacing, manual refetch, and live
 * `db:changed` updates for the page tree.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { EntityId, Page, PageTreeNode } from '@backend/shared/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPage } from '../../../test/test-utils';
import { useNotesStore } from '../../stores/notesStore';
import { usePageTree } from '../usePageTree';

function page(id: string, overrides: Partial<Page> = {}): Page {
  return createMockPage({ id: id as EntityId, ...overrides });
}

function node(pg: Page, children: PageTreeNode[] = []): PageTreeNode {
  return { page: pg, children };
}

/** root -> [a, b] */
function sampleTree(): PageTreeNode[] {
  return [
    node(page('root'), [
      node(page('a', { parentId: 'root' as EntityId, position: 0 })),
      node(page('b', { parentId: 'root' as EntityId, position: 1 })),
    ]),
  ];
}

let dbChangedCallback: ((payload: IpcEvents['db:changed']) => void) | null = null;
const treeMock = vi.fn();

const mockApi = {
  db: { pages: { tree: treeMock } },
  onDbChanged: vi.fn((callback: (payload: IpcEvents['db:changed']) => void) => {
    dbChangedCallback = callback;
    return () => {
      dbChangedCallback = null;
    };
  }),
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true });

function resetStore(): void {
  useNotesStore.setState({
    tree: [],
    pageMap: {},
    expanded: new Set(),
    activePageId: null,
    isLoading: false,
    error: null,
    dragState: {
      draggingId: null,
      validDropTargets: new Set(),
      dropPosition: null,
      dropTargetId: null,
    },
  });
}

describe('usePageTree', () => {
  const unmounts: Array<() => void> = [];

  beforeEach(() => {
    resetStore();
    dbChangedCallback = null;
    treeMock.mockReset();
    mockApi.onDbChanged.mockClear();
  });

  afterEach(() => {
    for (const unmount of unmounts) unmount();
    unmounts.length = 0;
  });

  function render() {
    const hook = renderHook(() => usePageTree());
    unmounts.push(hook.unmount);
    return hook;
  }

  it('fetches the tree on mount and exposes it', async () => {
    treeMock.mockResolvedValue({ ok: true, data: sampleTree() });

    const { result } = render();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tree.length).toBe(1);
    expect(result.current.tree[0]?.page.id).toBe('root');
    expect(result.current.error).toBeNull();
    expect(treeMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error when the tree fetch fails', async () => {
    treeMock.mockResolvedValue({ ok: false, error: 'boom' });

    const { result } = render();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('boom');
  });

  it('refetch issues another IPC call', async () => {
    treeMock.mockResolvedValue({ ok: true, data: sampleTree() });

    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refetch();
    });

    expect(treeMock).toHaveBeenCalledTimes(2);
  });

  it('applies a synchronous delete from db:changed', async () => {
    treeMock.mockResolvedValue({ ok: true, data: sampleTree() });

    const { result } = render();
    await waitFor(() => expect(result.current.tree.length).toBe(1));

    act(() => {
      dbChangedCallback?.({ table: 'pages', action: 'delete', id: 'b' });
    });

    const rootChildren = result.current.tree[0]?.children.map((n) => n.page.id);
    expect(rootChildren).toEqual(['a']);
  });

  it('refetches the tree on an insert db:changed event', async () => {
    treeMock.mockResolvedValue({ ok: true, data: sampleTree() });

    const { result } = render();
    await waitFor(() => expect(result.current.tree.length).toBe(1));
    expect(treeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      dbChangedCallback?.({ table: 'pages', action: 'insert', id: 'new-page' });
      await Promise.resolve();
    });

    await waitFor(() => expect(treeMock).toHaveBeenCalledTimes(2));
  });
});
