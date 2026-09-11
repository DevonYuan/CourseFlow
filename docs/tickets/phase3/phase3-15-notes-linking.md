---
applyTo: 'docs/tickets/phase3/phase3-15-notes-linking.md'
issue: 'N/A'
---

# phase3-15-notes-linking — Page Linking & Backlinks

## Description

Implement **wiki-style page linking** (`[[page title]]`) in the Markdown editor (Ticket 3.13) with automatic **backlinks panel** showing "Linked from" references. This creates a bidirectional knowledge graph within the Notes workspace, enabling Notion-style navigation.

**Prerequisites**: Ticket 3.11 (Pages Schema & IPC), Ticket 3.13 (Markdown Editor). The editor must already render Markdown; this ticket adds link parsing, creation, navigation, and backlink computation.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Wiki-link syntax**: Support `[[page title]]` in Markdown content. On render (preview), convert to internal link `<a href="/notes/:pageId" data-page-link>Page Title</a>`.
- [ ] **Link creation in editor**: 
  - Typing `[[` triggers autocomplete dropdown showing existing page titles (fuzzy search via `db:pages:search` or local tree).
  - Selecting a page inserts `[[Page Title]]` at cursor.
  - If page doesn't exist, allow "Create page 'Title'" option → creates new page via `db:pages:create` → inserts link.
- [ ] **Link navigation**: Clicking a wiki-link in preview navigates to `/notes/:pageId`. In editor (source mode), Ctrl+Click or context menu "Open link" navigates.
- [ ] **Backlinks panel**: In the editor (sidebar or bottom panel), show a **"Backlinks"** section listing all pages that link to the current page:
  - Each backlink shows: linking page title, icon, context snippet (surrounding text), and parent breadcrumb.
  - Clicking a backlink navigates to that page.
  - Backlinks update in real-time (via `db:changed` on `pages` table).
- [ ] **Broken link handling**: If `[[Non-existent Page]]` is rendered, show with a distinct style (dashed underline, red tint) and "Create this page" action on click.
- [ ] **Link reference storage**: For efficient backlink queries, maintain a **link reference table** (or compute on-demand). MVP: compute on-demand via FTS5 search for `[[current page title]]` in content. Future: materialized `page_links` table (source_id, target_id) updated on save.
- [ ] **Case-insensitive matching**: Wiki-links match page titles case-insensitively. `[[My Page]]` links to "my page".
- [ ] **Alias support (stretch)**: `[[page title|display text]]` — link to page but show custom text. MVP: skip, add later if needed.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **No separate link table for MVP**: Compute backlinks on-demand using FTS5: `SELECT * FROM pages_fts WHERE pages_fts MATCH '[[page title]]'`. This is fast enough for <10k pages. Avoid schema migration for a link table unless performance demands it.
- [ ] **FTS5 search for links**: The `pages_fts` table indexes `content`. Search for `[[exact title]]` requires escaping brackets. Use `'"[[My Page]]"'` (phrase match) or tokenize. Simpler: search for the title text and filter results where content contains `[[title]]` pattern.
- [ ] **Autocomplete source**: Use the existing page tree from sidebar store (already in memory) for instant autocomplete. No extra IPC call needed. Filter client-side.
- [ ] **Real-time backlinks**: On `db:changed` for `pages` (update/delete), re-run backlink search for affected pages. Debounce to avoid thrashing.
- [ ] **Broken link detection**: In preview render, check if linked page exists (via page tree map). If not, render as `<a class="broken-link" data-create-page="Title">Title</a>`.
- [ ] **Editor integration**: The autocomplete trigger `[[` should work in the textarea. Since we use a plain `<textarea>` (not CodeMirror), implement a floating dropdown positioned at cursor (use `textarea` `selectionStart` + `getBoundingClientRect` approximation or a simple fixed-position dropdown).
- [ ] **Preview link handling**: In `MarkdownPreview`, intercept clicks on `[data-page-link]` → prevent default → `navigate(/notes/${pageId})`.
- [ ] **Circular links**: Allow `[[A]]` in page A (self-link). Render as link to self. Backlinks will include the page itself (filter out or show as "Self-reference").
- [ ] **Performance**: Backlink search on every keystroke is heavy. Compute on editor mount, then refresh on `db:changed` for `pages` (debounced 500ms). Cache results per page.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/components/notes/MarkdownPreview.tsx` | Extend: parse `[[title]]` in markdown → internal links. Intercept clicks. Highlight broken links. |
| `src/frontend/src/components/notes/MarkdownEditor.tsx` | Add wiki-link autocomplete on `[[` trigger. Floating dropdown with page titles. |
| `src/frontend/src/components/notes/BacklinksPanel.tsx` | **New file**. Panel (collapsible) in editor showing backlinks list with snippets. |
| `src/frontend/src/hooks/useWikiLinks.ts` | **New file**. Logic for: parsing wiki-links from markdown, resolving to page IDs, generating backlinks via FTS5 search, autocomplete data. |
| `src/frontend/src/utils/markdown.ts` | Extend `parseMarkdown` to transform `[[title]]` → internal links with `data-page-link` and `data-page-title` attributes. |
| `src/frontend/src/stores/notesStore.ts` | Add backlinks cache: `Map<pageId, Backlink[]>`. Actions to invalidate on `db:changed`. |
| `src/frontend/src/components/notes/WikiLinkAutocomplete.tsx` | **New file**. Floating dropdown component for `[[` trigger. Fuzzy filters page titles. |

### Backend (optional — if materialized link table later)

| File | Change |
|------|--------|
| `src/backend/main/db/repository.ts` | Add `searchPagesByWikiLink(title: string): Promise<Page[]>` using FTS5 for backlink computation. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Wiki-link renders**: `[[Page Title]]` in markdown → clickable link in preview with correct href.
- [ ] **Autocomplete works**: Typing `[[` in editor shows dropdown with matching page titles. Selection inserts `[[Title]]`.
- [ ] **Create from link**: Autocomplete "Create page 'New Title'" → creates page → inserts link.
- [ ] **Link navigation**: Click link in preview → navigates to target page. Ctrl+Click in editor → navigates.
- [ ] **Backlinks panel**: Shows all pages linking to current page with context snippets. Updates when links added/removed.
- [ ] **Real-time backlinks**: Adding a link in Page A → Page B's backlinks panel updates within ~1s (via `db:changed`).
- [ ] **Broken links**: `[[Non-existent]]` renders with distinct style. Click → "Create this page" → creates and links.
- [ ] **Case-insensitive**: `[[my page]]` links to "My Page".
- [ ] **Self-links**: Page linking to itself renders correctly; backlinks exclude self or show as "Self-reference".
- [ ] **Performance**: Backlink computation <200ms for 1000 pages. Autocomplete instant (client-side).
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Markdown parsing for wiki-links**: Extend `marked` with a custom extension or post-process HTML. Simpler: pre-process markdown string before `marked()`:
  ```ts
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  markdown = markdown.replace(wikiLinkRegex, (_, title) => {
    const page = findPageByTitle(title.trim());
    if (page) return `<a href="/notes/${page.id}" data-page-link data-page-title="${escapeHtml(title)}">${escapeHtml(title)}</a>`;
    return `<a class="broken-link" data-create-page="${escapeHtml(title)}">${escapeHtml(title)}</a>`;
  });
  ```
- **FTS5 backlink query**: 
  ```sql
  SELECT p.*, snippet(pages_fts, '<mark>', '</mark>', '…', 64) as snippet
  FROM pages_fts
  JOIN pages p ON pages_fts.id = p.id
  WHERE pages_fts MATCH ?
  ORDER BY bm25(pages_fts)
  LIMIT 50;
  ```
  Bind `?` = `'"[[Page Title]]"'` (phrase match with brackets). May need to escape title for FTS5.
- **Autocomplete positioning**: For plain textarea, use a simplified approach — show dropdown at fixed position near editor top, or use a library like `textarea-caret-position` for cursor coordinates.
- **Backlink snippet**: FTS5 `snippet()` returns text around match. The match will be the wiki-link syntax. Good enough for context.
- **Playwright tests**: `src/frontend/test/notes-linking.spec.ts`. Test: wiki-link render, autocomplete, create-from-link, navigation, backlinks panel, broken links, real-time updates, case-insensitivity.
- **Future enhancement**: Materialized `page_links` table for O(1) backlinks. Would require migration and update triggers on `pages.content` change.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Wiki-style [[page links]] with autocomplete, navigation, broken-link creation, and real-time backlinks panel.