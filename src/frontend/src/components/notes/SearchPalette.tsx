/**
 * SearchPalette — Command-palette style full-text search overlay
 *
 * A centered modal that searches all standalone pages. Opens via Cmd+K /
 * Ctrl+K from anywhere in the app or the Notes sidebar "Search" button.
 * Shows recently-updated pages when the query is empty and ranked results
 * (with snippets + breadcrumbs) as the user types.
 *
 * @module @frontend/components/notes/SearchPalette
 */

import type { Page } from '@backend/shared/types';
import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
import { usePageSearch } from '../../hooks/usePageSearch';
import { selectSearchPaletteOpen, useSearchPaletteStore } from '../../stores/searchPaletteStore';

import { SearchResultItem } from './SearchResultItem';
import { SearchIcon } from './icons';
import './SearchPalette.css';

const LISTBOX_ID = 'search-palette-listbox';

function optionId(index: number): string {
  return `search-palette-option-${index}`;
}

/**
 * Global search overlay. Kept mounted for the app's lifetime so the Cmd+K
 * shortcut stays registered; renders nothing while closed.
 */
export function SearchPalette(): JSX.Element | null {
  const isOpen = useSearchPaletteStore(selectSearchPaletteOpen);
  const close = useSearchPaletteStore((s) => s.close);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    query,
    isSearching,
    error,
    hasQuery,
    items,
    itemCount,
    selectedIndex,
    setQuery,
    loadCatalog,
    reset,
    move,
    breadcrumbsOf,
  } = usePageSearch();

  // Keep the global Cmd+K / Ctrl+K shortcut registered for the app's lifetime.
  useGlobalShortcuts();

  const containerRef = useFocusTrap({
    isActive: isOpen,
    onEscape: close,
    initialFocusRef: inputRef,
  });

  // On open: reset state and warm the page catalog (recent pages + breadcrumbs).
  useEffect(() => {
    if (!isOpen) return;
    reset();
    void loadCatalog();
  }, [isOpen, reset, loadCatalog]);

  const openResult = useCallback(
    (page: Page) => {
      void navigate(`/notes/${page.id}`);
      close();
    },
    [navigate, close],
  );

  const openSearchResultsPage = useCallback(() => {
    const q = encodeURIComponent(query.trim());
    void navigate(`/notes/search?q=${q}`);
    close();
  }, [navigate, query, close]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          move(1);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          move(-1);
          break;
        }
        case 'Enter': {
          event.preventDefault();
          const item = items[selectedIndex];
          if (item) {
            openResult(item.page);
          } else if (hasQuery) {
            openSearchResultsPage();
          }
          break;
        }
        // No default
      }
    },
    [move, items, selectedIndex, hasQuery, openResult, openSearchResultsPage],
  );

  if (!isOpen) return null;

  const activeDescendant =
    hasQuery && !isSearching && itemCount > 0 ? optionId(selectedIndex) : undefined;

  const showRecent = !hasQuery;
  const showNoResults =
    hasQuery && !isSearching && itemCount === 0 && !error;

  return (
    <div
      className="search-palette__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={containerRef}
        className="search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search pages"
      >
        <div className="search-palette__input-row">
          <span className="search-palette__input-icon" aria-hidden="true">
            <SearchIcon size={16} />
          </span>
          <input
            ref={inputRef}
            className="search-palette__input"
            type="text"
            placeholder="Search pages…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            role="combobox"
            aria-label="Search pages"
            aria-controls={LISTBOX_ID}
            aria-expanded={isOpen}
            aria-activedescendant={activeDescendant}
            autoComplete="off"
            spellCheck={false}
          />
          {hasQuery && (
            <button
              type="button"
              className="search-palette__view-all"
              onClick={openSearchResultsPage}
            >
              View all
            </button>
          )}
        </div>

        <ul id={LISTBOX_ID} role="listbox" className="search-palette__list">
          {showRecent && (
            <>
              <li className="search-palette__group-label" role="presentation">
                Recent
              </li>
              {items.map((item, index) => (
                <SearchResultItem
                  key={item.page.id}
                  page={item.page}
                  snippet={item.snippet}
                  query={''}
                  breadcrumbs={breadcrumbsOf(item.page)}
                  selected={index === selectedIndex}
                  id={optionId(index)}
                  onSelect={() => openResult(item.page)}
                />
              ))}
              {itemCount === 0 && (
                <li className="search-palette__empty" role="presentation">
                  No pages yet. Create one from the Notes sidebar.
                </li>
              )}
            </>
          )}

          {!showRecent && isSearching && (
            <li className="search-palette__status" role="presentation">
              Searching…
            </li>
          )}

          {!showRecent && !isSearching && items.map((item, index) => (
            <SearchResultItem
              key={item.page.id}
              page={item.page}
              snippet={item.snippet}
              query={query}
              breadcrumbs={breadcrumbsOf(item.page)}
              selected={index === selectedIndex}
              id={optionId(index)}
              onSelect={() => openResult(item.page)}
            />
          ))}

          {showNoResults && (
            <li className="search-palette__empty" role="presentation">
              No pages found for “{query.trim()}”.
            </li>
          )}

          {!showRecent && error && (
            <li className="search-palette__empty search-palette__empty--error" role="presentation">
              {error}
            </li>
          )}
        </ul>

        <footer className="search-palette__footer">
          <span className="search-palette__hint">
            <kbd>↑</kbd> <kbd>↓</kbd> Navigate
          </span>
          <span className="search-palette__hint">
            <kbd>↵</kbd> Open
          </span>
          <span className="search-palette__hint">
            <kbd>esc</kbd> Close
          </span>
        </footer>
      </div>
    </div>
  );
}