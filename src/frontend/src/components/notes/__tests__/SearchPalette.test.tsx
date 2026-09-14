/**
 * SearchPalette Component Tests
 *
 * Covers opening the overlay, rendering recent pages, debounced search
 * results + snippet/breadcrumb rendering, and navigation on Enter.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { EntityId, Page, PageSearchResult, PageTreeNode } from '@backend/shared/types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPage } from '../../../../test/test-utils';
import { useSearchPaletteStore } from '../../../stores/searchPaletteStore';
import { SearchPalette } from '../SearchPalette';

/** Reports the current pathname so we can assert navigation happened. */
function LocationSpy(): JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function searchResult(pageIn: Page, snippet: string): PageSearchResult {
  return { page: pageIn, rank: 0, snippet };
}

const searchMock = vi.fn<
  (input: { query: string; limit?: number }) => Promise<{
    ok: boolean;
    data: PageSearchResult[];
  }>
>();
const treeMock = vi.fn<() => Promise<{ ok: boolean; data: PageTreeNode[] }>>();
const mockApi = {
  db: {
    pages: {
      search: searchMock,
      tree: treeMock,
    },
  },
  onDbChanged: vi.fn<(cb: (payload: IpcEvents['db:changed']) => void) => () => void>(),
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true });

function setOpen(open: boolean): void {
  useSearchPaletteStore.setState({ isOpen: open });
}

function renderPalette(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LocationSpy />} />
        <Route path="/notes/:pageId" element={<LocationSpy />} />
      </Routes>
      <SearchPalette />
    </MemoryRouter>,
  );
}

const root = createMockPage({ id: 'page-root' as EntityId, title: 'Class Notes', content: 'welcome' });
const lecture1 = createMockPage({
  id: 'page-1' as EntityId,
  title: 'Lecture 1',
  content: 'variables',
  parentId: 'page-root' as EntityId,
});

describe('SearchPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.onDbChanged.mockReturnValue(() => undefined);
    treeMock.mockResolvedValue({
      ok: true,
      data: [{ page: root, children: [{ page: lecture1, children: [] }] }],
    });
    searchMock.mockImplementation(async (input: { query: string; limit?: number }) => {
      const q = (input.query ?? '').toLowerCase();
      if (q.includes('lecture')) {
        return { ok: true, data: [searchResult(lecture1, '<mark>Lecture</mark> 1')] };
      }
      return { ok: true, data: [] };
    });
    setOpen(false);
  });

  afterEach(() => {
    cleanup();
    setOpen(false);
  });

  it('renders nothing while closed and a dialog when opened', async () => {
    renderPalette();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByPlaceholderText('Search pages…')).toBeNull();

    setOpen(true);
    const dialog = await screen.findByRole('dialog', { name: 'Search pages' });
    expect(dialog).toBeTruthy();
    expect(screen.getByPlaceholderText('Search pages…')).toBeTruthy();
  });

  it('shows recent pages when the query is empty', async () => {
    renderPalette();
    setOpen(true);

    await screen.findByRole('dialog');
    expect(await screen.findByText('Recent')).toBeTruthy();
    // Both seeded pages appear as recent-option rows (title or breadcrumb).
    const options = await screen.findAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    const joined = options.map((o) => o.textContent ?? '').join(' | ');
    expect(joined).toContain('Class Notes');
    expect(joined).toContain('Lecture 1');
  });

  it('searches (debounced) and renders highlighted results with breadcrumbs', async () => {
    renderPalette();
    setOpen(true);
    await screen.findByRole('dialog');

    const input = screen.getByPlaceholderText('Search pages…');
    await userEvent.type(input, 'lecture');

    // Wait on the result row (its text is split by the highlight <mark>).
    expect(await screen.findByRole('option', { name: /Lecture 1/ })).toBeTruthy();
    // The result row highlights the match with <mark>.
    const titleEl = document.querySelector('.search-palette__result-title');
    expect(titleEl?.querySelector('mark')?.textContent).toBe('Lecture');
    // The nested page shows its parent breadcrumb.
    const breadcrumb = document.querySelector('.search-palette__result-breadcrumbs');
    expect(breadcrumb?.textContent).toContain('Class Notes');
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'lecture', limit: 20 }),
    );
  });

  it('navigates to the selected page on Enter', async () => {
    renderPalette();
    setOpen(true);
    await screen.findByRole('dialog');

    const input = screen.getByPlaceholderText('Search pages…');
    await userEvent.type(input, 'lecture');
    await screen.findByRole('option', { name: /Lecture 1/ });

    await userEvent.keyboard('{Enter}');

    // Enter opens the top (selected) result and closes the dialog.
    await screen.findByTestId('location');
    expect(document.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/notes/page-1',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});