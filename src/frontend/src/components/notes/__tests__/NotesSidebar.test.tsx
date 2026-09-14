/**
 * NotesSidebar Component Tests
 *
 * Covers the header actions — specifically that "New subfolder" creates a
 * folder under the selected page (or at the top level when none is selected)
 * and expands the parent so the new folder is visible.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { EntityId, Page, PageTreeNode } from '@backend/shared/types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPage } from '../../../../test/test-utils';
import { ToastProvider } from '../../../context/ToastContext';
import { useNotesStore } from '../../../stores/notesStore';
import { NotesSidebar } from '../NotesSidebar';

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const createMock = vi.fn<(input: { parentId?: EntityId | null; title: string }) => Promise<Result<Page>>>();
const treeMock = vi.fn<() => Promise<Result<PageTreeNode[]>>>(async () => ({ ok: true, data: [] }));

const mockApi = {
  db: {
    pages: {
      create: createMock,
      tree: treeMock,
      list: async () => ({ ok: true, data: [] as Page[] }),
      get: async () => ({ ok: true, data: null as Page | null }),
      update: async () => ({ ok: true, data: createMockPage() }),
      delete: async () => ({ ok: true, data: undefined }),
      move: async () => ({ ok: true, data: createMockPage() }),
      search: async () => ({ ok: true, data: [] }),
    },
  },
  onDbChanged: vi.fn<(cb: (payload: IpcEvents['db:changed']) => void) => () => void>(),
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true });

const ideasId = 'page-4' as EntityId;

function renderSidebar(currentPageId: EntityId | null = null): void {
  render(
    <ToastProvider>
      <MemoryRouter>
        <NotesSidebar currentPageId={currentPageId} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

function resetStore(): void {
  const ideas = createMockPage({ id: ideasId, title: 'Ideas', parentId: null });
  useNotesStore.setState({
    tree: [],
    pageMap: {},
    expanded: new Set(),
    activePageId: null,
    isLoading: false,
    error: null,
    renameState: { renamingId: null, inputValue: '' },
  });
  useNotesStore.getState().setTree([{ page: ideas, children: [] }]);
}

describe('NotesSidebar — New subfolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockApi.onDbChanged.mockReturnValue(() => undefined);
    createMock.mockResolvedValue({
      ok: true,
      data: createMockPage({ id: 'new-folder' as EntityId, title: 'New Folder' }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('creates a subfolder under the selected page and expands the parent', async () => {
    renderSidebar(ideasId);

    await userEvent.click(screen.getByRole('button', { name: 'New subfolder' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ parentId: ideasId, title: 'New Folder' });
    });
    expect(useNotesStore.getState().expanded.has(ideasId)).toBe(true);
  });

  it('creates a top-level folder when no page is selected', async () => {
    renderSidebar(null);

    await userEvent.click(screen.getByRole('button', { name: 'New subfolder' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ parentId: null, title: 'New Folder' });
    });
  });
});
