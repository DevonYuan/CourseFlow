/**
 * SearchResultItem — Single page result for the search UI
 *
 * Shared presentational component used by both the command palette and the
 * dedicated search-results page. Renders the page icon, highlighted title,
 * highlighted snippet, and parent-page breadcrumb.
 *
 * @module @frontend/components/notes/SearchResultItem
 */

import type { Page } from '@backend/shared/types';
import React, { type ReactNode } from 'react';

import { createSafeHtml } from '../../utils/sanitize';

import { PageIcon } from './icons';

interface HighlightedTextProps {
  text: string;
  query: string;
}

/**
 * Renders `text` with every (case-insensitive) occurrence of `query` wrapped
 * in `<mark>`. Falls back to plain text when the query is empty.
 */
export function HighlightedText({ text, query }: HighlightedTextProps): JSX.Element {
  const q = query.trim();
  if (!q) {
    return <span>{text}</span>;
  }
  const needle = q.toLowerCase();
  const haystack = text.toLowerCase();
  const parts: ReactNode[] = [];
  let index = 0;
  let key = 0;
  for (;;) {
    const matchAt = haystack.indexOf(needle, index);
    if (matchAt === -1) {
      if (index < text.length) {
        parts.push(<span key={key}>{text.slice(index)}</span>);
        key += 1;
      }
      break;
    }
    if (matchAt > index) {
      parts.push(<span key={key}>{text.slice(index, matchAt)}</span>);
      key += 1;
    }
    parts.push(<mark key={key}>{text.slice(matchAt, matchAt + q.length)}</mark>);
    key += 1;
    index = matchAt + q.length;
  }
  return <span>{parts}</span>;
}

interface SearchResultItemProps {
  page: Page;
  /** Raw (already-`<mark>`-styled) snippet HTML from the backend. */
  snippet: string;
  /** Query used to highlight the title. */
  query: string;
  /** Parent-page titles, top-of-tree first. */
  breadcrumbs: string[];
  /** Whether the row is the active keyboard selection. */
  selected: boolean;
  id: string;
  onSelect: () => void;
}

/**
 * A single selectable search result row.
 */
export function SearchResultItem({
  page,
  snippet,
  query,
  breadcrumbs,
  selected,
  id,
  onSelect,
}: SearchResultItemProps): JSX.Element {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      className={`search-palette__result${selected ? ' search-palette__result--active' : ''}`}
      onMouseDown={(event) => {
        // Use mousedown so the input never loses focus before navigation.
        event.preventDefault();
        onSelect();
      }}
    >
      <span className="search-palette__result-icon" aria-hidden="true">
        <PageIcon size={16} />
      </span>
      <span className="search-palette__result-body">
        <span className="search-palette__result-title">
          <HighlightedText text={page.title} query={query} />
        </span>
        {breadcrumbs.length > 0 && (
          <span className="search-palette__result-breadcrumbs">
            {breadcrumbs.join(' > ')}
          </span>
        )}
        {snippet && (
          <span
            className="search-palette__result-snippet"
            // Snippet is produced by the backend with `escapeSnippetText` and
            // only adds `<mark>` tags; DOMPurify still sanitizes it defensively.
            dangerouslySetInnerHTML={createSafeHtml(snippet)}
          />
        )}
      </span>
    </li>
  );
}