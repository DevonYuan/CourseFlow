/**
 * notesStore Unit Tests
 *
 * Covers tree flattening into the page map, expanded state, optimistic
 * create/move/delete/update, descendant lookup, and drop validation.
 */

import type { EntityId, Page, PageTreeNode } from '@backend/shared/types';
import { beforeEach, describe, expect, it } from 'vitest';

import { createMockPage } from '../../../test/test-utils';
import { useNotesStore } from '../notesStore';

function page(id: string, overrides: Partial<Page> = {}): Page {
  return createMockPage({ id: id as EntityId, ...overrides });
}

function node(pg: Page, children: PageTreeNode[] = []): PageTreeNode {
  return { page: pg, children };
}

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
    renameState: { renamingId: null, inputValue: '' },
  });
}

/** root -> [a -> [a1], b] */
function sampleTree(): PageTreeNode[] {
  return [
    node(page('root'), [
      node(page('a', { parentId: 'root' as EntityId, position: 0 }), [
        node(page('a1', { parentId: 'a' as EntityId, position: 0 })),
      ]),
      node(page('b', { parentId: 'root' as EntityId, position: 1 })),
    ]),
  ];
}

describe('notesStore', () => {
  beforeEach(resetStore);

  it('setTree rebuilds the flattened page map with parentId and depth', () => {
    useNotesStore.getState().setTree(sampleTree());

    const { pageMap } = useNotesStore.getState();
    expect(pageMap['root']?.parentId).toBeNull();
    expect(pageMap['root']?.depth).toBe(0);
    expect(pageMap['root']?.children).toEqual(['a', 'b']);
    expect(pageMap['a']?.parentId).toBe('root' as EntityId);
    expect(pageMap['a1']?.parentId).toBe('a' as EntityId);
    expect(pageMap['a1']?.depth).toBe(2);
  });

  it('toggles expanded state per page id', () => {
    useNotesStore.getState().toggleExpanded('root' as EntityId);
    expect(useNotesStore.getState().expanded.has('root' as EntityId)).toBe(true);

    useNotesStore.getState().toggleExpanded('root' as EntityId);
    expect(useNotesStore.getState().expanded.has('root' as EntityId)).toBe(false);
  });

  it('optimistically moves a page to a new sibling position', () => {
    useNotesStore.getState().setTree(sampleTree());
    useNotesStore.getState().optimisticMove('b' as EntityId, 'root' as EntityId, 0);

    const children = useNotesStore.getState().tree[0]?.children.map((n) => n.page.id);
    expect(children).toEqual(['b', 'a']);
    expect(useNotesStore.getState().pageMap['b']?.parentId).toBe('root');
  });

  it('optimistically unnests a page to the root level', () => {
    useNotesStore.getState().setTree(sampleTree());
    useNotesStore.getState().optimisticMove('a' as EntityId, null, 0);

    const roots = useNotesStore.getState().tree.map((n) => n.page.id);
    expect(roots).toEqual(['a', 'root']);
    expect(useNotesStore.getState().pageMap['a']?.parentId).toBeNull();
  });

  it('optimistically deletes a page and all of its descendants', () => {
    useNotesStore.getState().setTree(sampleTree());
    useNotesStore.getState().optimisticDelete('a' as EntityId);

    const rootChildren = useNotesStore.getState().tree[0]?.children.map((n) => n.page.id);
    expect(rootChildren).toEqual(['b']);
    expect(useNotesStore.getState().pageMap['a']).toBeUndefined();
    expect(useNotesStore.getState().pageMap['a1']).toBeUndefined();
  });

  it('optimistically inserts a new child page', () => {
    useNotesStore.getState().setTree(sampleTree());
    useNotesStore
      .getState()
      .optimisticCreate(page('new', { parentId: 'a' as EntityId, position: 0 }), 'a' as EntityId);

    const aChildren = useNotesStore.getState().pageMap['a']?.children;
    expect(aChildren).toEqual(['a1', 'new']);
  });

  it('optimistically updates a page field (rename)', () => {
    useNotesStore.getState().setTree(sampleTree());
    useNotesStore.getState().optimisticUpdate('b' as EntityId, { title: 'Renamed' });

    expect(useNotesStore.getState().pageMap['b']?.page.title).toBe('Renamed');
  });

  it('returns all descendant ids for a page', () => {
    useNotesStore.getState().setTree(sampleTree());

    expect(useNotesStore.getState().getDescendantIds('root' as EntityId).sort()).toEqual([
      'a',
      'a1',
      'b',
    ]);
  });

  it('prevents dropping a page onto itself or its descendants', () => {
    useNotesStore.getState().setTree(sampleTree());
    const { canDropInto } = useNotesStore.getState();

    expect(canDropInto('root' as EntityId, 'root' as EntityId)).toBe(false);
    expect(canDropInto('root' as EntityId, 'a1' as EntityId)).toBe(false);
    expect(canDropInto('b' as EntityId, 'root' as EntityId)).toBe(true);
  });

  it('clears the active page when it is removed by a remote delete event', () => {
    useNotesStore.getState().setTree(sampleTree());
    useNotesStore.getState().setActivePage('b' as EntityId);

    useNotesStore.getState().handleDbChanged({ table: 'pages', action: 'delete', id: 'b' });

    expect(useNotesStore.getState().activePageId).toBeNull();
    expect(useNotesStore.getState().pageMap['b']).toBeUndefined();
  });
});
