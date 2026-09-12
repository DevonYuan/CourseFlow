/**
 * PageTree Component Tests
 *
 * Covers tree rendering (collapsed/expanded), ARIA structure, the empty
 * state CTA, keyboard expand, inline rename, and delete confirmation.
 */

// @vitest-environment jsdom

import type { EntityId, Page, PageTreeNode } from '@backend/shared/types';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPage } from '../../../../test/test-utils';
import { ToastProvider } from '../../../context/ToastContext';
import { useNotesStore } from '../../../stores/notesStore';
import { PageTree } from '../PageTree';

function page(id: string, overrides: Partial<Page> = {}): Page {
  return createMockPage({ id: id as EntityId, ...overrides });
}

/** root -> [a -> [a1], b] */
function sampleTree(): PageTreeNode[] {
  return [
    {
      page: page('root', { title: 'Class Notes', icon: '📚' }),
      children: [
        {
          page: page('a', { title: 'Lecture 1', parentId: 'root' as EntityId, position: 0 }),
          children: [page('a1', { title: 'Notes A1', parentId: 'a' as EntityId, position: 0 })].map(
            (p) => ({ page: p, children: [] }),
          ),
        },
        {
          page: page('b', { title: 'Lecture 2', parentId: 'root' as EntityId, position: 1 }),
          children: [],
        },
      ],
    },
  ];
}

const pagesApi = {
  tree: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  move: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
};

const noopUnsubscribe = (): void => undefined;
const unsubscribeFactory = (): (() => void) => noopUnsubscribe;

const mockApi = {
  db: { pages: pagesApi },
  onDbChanged: vi.fn(unsubscribeFactory),
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true });

function resetPagesApi(): void {
  for (const fn of Object.values(pagesApi)) {
    fn.mockReset();
  }
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

async function renderTree(onSelect = vi.fn()): Promise<ReturnType<typeof render>> {
  const utils = render(
    <ToastProvider>
      <PageTree onSelect={onSelect} />
    </ToastProvider>,
  );
  await waitFor(() => {
    expect(screen.queryAllByRole('treeitem').length).toBeGreaterThan(0);
  });
  return utils;
}

describe('PageTree', () => {
  beforeEach(() => {
    resetStore();
    resetPagesApi();
    pagesApi.tree.mockResolvedValue({ ok: true, data: sampleTree() });
    pagesApi.update.mockImplementation(async (input: { id: string }) => ({
      ok: true,
      data: page(input.id),
    }));
    pagesApi.delete.mockResolvedValue({ ok: true, data: undefined });
    pagesApi.create.mockResolvedValue({ ok: true, data: page('new') });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders only root pages while parents are collapsed', async () => {
    await renderTree();

    const items = screen.getAllByRole('treeitem');
    expect(items.length).toBe(1);
    expect(items[0]?.getAttribute('aria-level')).toBe('1');
    expect(items[0]?.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands a parent to reveal children with correct levels', async () => {
    await renderTree();

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    await waitFor(() => {
      expect(screen.getAllByRole('treeitem').length).toBe(3);
    });

    const titles = screen.getAllByRole('treeitem').map((el) => el.textContent ?? '');
    expect(titles.some((t) => t.includes('Lecture 1'))).toBe(true);
    expect(titles.some((t) => t.includes('Lecture 2'))).toBe(true);

    const child = screen.getByText('Lecture 1').closest('[role="treeitem"]');
    expect(child?.getAttribute('aria-level')).toBe('2');
  });

  it('expands with the ArrowRight keyboard shortcut', async () => {
    await renderTree();

    const root = screen.getAllByRole('treeitem')[0] as HTMLElement;
    fireEvent.keyDown(root, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getAllByRole('treeitem').length).toBe(3);
    });
  });

  it('shows an empty state CTA that creates a root page', async () => {
    pagesApi.tree.mockResolvedValue({ ok: true, data: [] });

    render(
      <ToastProvider>
        <PageTree onSelect={vi.fn()} />
      </ToastProvider>,
    );

    const cta = await screen.findByRole('button', { name: 'Create your first page' });
    fireEvent.click(cta);

    await waitFor(() => {
      expect(pagesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null, title: 'New Page' }),
      );
    });
  });

  it('renames a page inline with F2 + Enter', async () => {
    // Expand so the target child is visible.
    await renderTree();
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    await waitFor(() => expect(screen.getAllByRole('treeitem').length).toBe(3));

    const node = screen.getByText('Lecture 1').closest('[role="treeitem"]') as HTMLElement;
    fireEvent.keyDown(node, { key: 'F2' });

    const input = await screen.findByRole('textbox', { name: 'Page title' });
    fireEvent.change(input, { target: { value: 'Renamed Lecture' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(pagesApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a', title: 'Renamed Lecture' }),
      );
    });
  });

  it('deletes a page after confirming the modal', async () => {
    await renderTree();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Class Notes' }));
    const deleteItem = await screen.findByRole('menuitem', { name: /Delete/ });
    fireEvent.click(deleteItem);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = dialog.querySelector('button.modal__button--delete') as HTMLButtonElement;
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(pagesApi.delete).toHaveBeenCalledWith('root');
    });
  });
});
