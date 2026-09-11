---
applyTo: 'docs/tickets/phase3/phase3-14-notes-search.md'
issue: 'N/A'
---

# phase3-14-notes-search — Full-Text Search

## Description

Implement **full-text search** across all standalone pages using SQLite FTS5. Users can search page titles and content instantly via a command palette (Cmd+K / Cmd+Shift+P style) and a dedicated search results view. Results are ranked by relevance (BM25) with snippet previews.

**Prerequisite**: Ticket 3.11 (Pages Schema & IPC) — FTS5 virtual table `pages_fts` and `db:pages:search` IPC must exist.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Command palette**: Global keyboard shortcut `Cmd+K` (Mac) / `Ctrl+K` (Win/Linux) opens a search overlay (command palette) from anywhere in the app. Also accessible via "Search" button in Notes sidebar header.
- [ ] **Search input**: Palette shows a search input with placeholder "Search pages…". As user types (debounced ~150ms), call `db:pages:search` with query and limit (default 20).
- [ ] **Results rendering**: Display results as a list with:
  - Page title (highlighted match)
  - Snippet from content (FTS5 `snippet()` function) with match highlights
  - Page icon
  - Parent page breadcrumb (e.g., "Folder > Subfolder > Page")
- [ ] **Navigation**: Clicking a result (or Enter) navigates to `/notes/:pageId` and closes the palette. Sidebar highlights the page.
- [ ] **Dedicated search results view**: Optional — a `/notes/search?q=...` route showing full results list with pagination for long queries. Accessible from palette "View all results" link.
- [ ] **Recent pages fallback**: When search input is empty, show recently updated pages (from `idx_pages_updated` or `db:pages:list` with limit).
- [ ] **Keyboard navigation in palette**: ↑/↓ to select result, Enter to open, Escape to close. Focus management: input focused on open, previous focus restored on close.
- [ ] **Search ranking**: Backend uses FTS5 `bm25()` for ranking. Results sorted by rank (best first). Snippet uses `snippet(pages_fts, '<mark>', '</mark>', '…', 32)` for context.
- [ ] **Case-insensitive, prefix matching**: FTS5 default is case-insensitive for ASCII. Use `query + '*'` for prefix matching (e.g., "note*" matches "notebook").
- [ ] **Debouncing & cancellation**: Debounce IPC calls. Cancel previous in-flight request when new query typed (AbortController pattern).
- [ ] **Performance**: Search must feel instant (<100ms perceived latency). FTS5 on <10k pages is sub-millisecond. Debounce + caching ensures smooth UX.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Global vs. scoped**: Command palette is global (works from Assignments view too). Results only show pages (not assignments). Future: unified search across assignments + pages.
- [ ] **Palette UI**: Centered modal overlay with backdrop. Max height ~60% viewport. Scrollable results. Close on Escape, click backdrop, or navigation.
- [ ] **Snippet generation**: Backend returns snippet via FTS5 `snippet()` function. Frontend renders as HTML (sanitized) with `<mark>` tags for highlights.
- [ ] **Breadcrumb**: For each result, show ancestry path (parent > grandparent > page). Can be computed in backend (recursive CTE) or frontend (from tree). Backend preferred for accuracy.
- [ ] **No results state**: Show "No pages found for 'query'" with suggestion to create a new page.
- [ ] **Accessibility**: Palette uses `role="dialog"`, `aria-modal="true"`, `aria-label="Search pages"`. Results list uses `role="listbox"`, items `role="option"`. Focus trap within palette.
- [ ] **Index maintenance**: FTS5 triggers (Ticket 3.11) keep `pages_fts` in sync automatically. Verify triggers fire on all mutations (create, update, delete, move — move doesn't change content but updates `updated_at`).
- [ ] **Search scope**: MVP searches `title` and `content` columns. Future: search tags, filter by date, filter by parent folder.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/components/notes/SearchPalette.tsx` | **New file**. Command palette modal: input, results list, keyboard nav, focus trap, recent pages fallback. |
| `src/frontend/src/pages/NotesSearchResults.tsx` | **New file** (optional). Dedicated search results page at `/notes/search?q=...` for long result sets. |
| `src/frontend/src/hooks/usePageSearch.ts` | **New file**. Hook for debounced search, AbortController management, recent pages cache, keyboard shortcut registration. |
| `src/frontend/src/components/notes/NotesSidebar.tsx` | Add "Search" button in sidebar header that opens palette. |
| `src/frontend/src/hooks/useGlobalShortcuts.ts` | **New file** (or extend). Register `Cmd+K` / `Ctrl+K` globally (when not in text input) to open palette. |
| `src/frontend/src/stores/notesStore.ts` | Add search state: `query`, `results`, `isSearching`, `recentPages`. |

### Backend (verify IPC)

| File | Change |
|------|--------|
| `src/backend/main/db/repository.ts` | Verify `searchPages(query, limit)` uses FTS5: `SELECT p.*, bm25(pages_fts) as rank, snippet(pages_fts, ...) as snippet FROM pages_fts JOIN pages p ON pages_fts.id = p.id WHERE pages_fts MATCH ? ORDER BY rank LIMIT ?`. |
| `src/backend/main/ipc-handlers.ts` | Verify `db:pages:search` handler calls repository and returns `PageSearchResult[]`. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Palette opens**: Cmd+K / Ctrl+K opens palette from any view (Assignments, Notes, Settings).
- [ ] **Search works**: Typing in palette calls `db:pages:search` → results appear with title, snippet, icon, breadcrumb.
- [ ] **Ranking correct**: Results ordered by BM25 relevance (best match first).
- [ ] **Snippets highlight**: Matching terms wrapped in `<mark>` in snippet, rendered with highlight style.
- [ ] **Navigation**: Click/Enter on result → navigates to `/notes/:pageId` → palette closes → sidebar highlights page.
- [ ] **Keyboard nav**: ↑/↓ selects, Enter opens, Escape closes. Focus restored on close.
- [ ] **Recent pages**: Empty query shows recently updated pages (max 10).
- [ ] **Debounce**: Rapid typing sends only 1 request per ~150ms. Previous requests cancelled.
- [ ] **No results**: Shows helpful empty state.
- [ ] **Dedicated view (optional)**: `/notes/search?q=...` shows paginated results.
- [ ] **Global shortcut disabled in inputs**: Cmd+K doesn't open palette when focused in a text input/textarea (editor, search input itself).
- [ ] **Performance**: Search feels instant (<100ms UI response for typical queries).
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **FTS5 query syntax**: User input passed to `MATCH` should be sanitized. Escape FTS5 special characters (`"`, `*`, `-`, `+`, `(`, `)`) or wrap in quotes for phrase search. For MVP: simple prefix matching — append `*` to each term: `"hello world" → "hello* world*"`.
- **AbortController pattern**: 
  ```ts
  const abortRef = useRef<AbortController>();
  const search = async (query) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const results = await api.db.pages.search({ query, limit: 20 }, { signal: abortRef.current.signal });
  };
  ```
- **Recent pages cache**: Fetch once on palette open via `db:pages:list({ parentId: null })` with limit 10 ordered by `updated_at DESC`, or maintain in store from `db:changed` events.
- **Breadcrumb computation**: Backend can return `ancestors: { id: string; title: string }[]` in `PageSearchResult` using recursive CTE:
  ```sql
  WITH RECURSIVE ancestors AS (
    SELECT id, title, parent_id, 1 as level FROM pages WHERE id = ?
    UNION ALL
    SELECT p.id, p.title, p.parent_id, a.level + 1 FROM pages p JOIN ancestors a ON p.id = a.parent_id
  ) SELECT * FROM ancestors ORDER BY level DESC;
  ```
- **Playwright tests**: `src/frontend/test/notes-search.spec.ts`. Test: palette open/close, search typing, results ranking, snippet highlights, navigation, keyboard, recent pages, empty state, global shortcut blocking in inputs.
- **Dependencies**: No new deps — uses existing `marked`, `dompurify` for snippet rendering (snippet is plain text with `<mark>`, so minimal sanitization).

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Full-text search across pages with Cmd+K palette, BM25 ranking, snippet highlights, breadcrumbs, and keyboard navigation.