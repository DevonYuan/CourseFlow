---
applyTo: 'docs/tickets/phase3/phase3-14-notes-search.md'
issue: 'N/A'
---

# phase3-14-notes-search — Full-Text Search

## Description

Implement **full-text search** across all standalone pages using SQLite FTS5. Users can search page titles and content instantly via a command palette (Cmd+K / Cmd+Shift+P style) and a dedicated search results view. Results are ranked by relevance (BM25) with snippet previews.

**Prerequisite**: Ticket 3.11 (Pages Schema & IPC) — FTS5 virtual table `pages_fts` and `db:pages:search` IPC must exist.

## Implementation Status (Sep 2026) — Complete

Implemented and verified (unit + E2E green).

**Key deviation — no FTS5.** The sql.js (WASM) SQLite build shipped with the app
has **no `fts5` module**, so `pages_fts`, `bm25()` and `snippet()` are unavailable
(`CREATE VIRTUAL TABLE ... USING fts5` aborts app startup). Search is backed by a
`LIKE ... ESCAPE '!'` query in `repo.searchPages` plus a `buildSearchSnippet()`
helper that emits `<mark>` markup — same UX, different engine. Ranking is
title-match (rank 0) before content-only match (rank 1), then `updated_at DESC`.
Breadcrumbs are computed on the frontend from the page tree. The dedicated
results page is implemented without pagination (limit 50).

## Requirements

> Document WHAT is needed and WHY it is needed.

- [x] **Command palette**: Global keyboard shortcut `Cmd+K` (Mac) / `Ctrl+K` (Win/Linux) opens a search overlay (command palette) from anywhere in the app. Also accessible via "Search" button in Notes sidebar header.
- [x] **Search input**: Palette shows a search input with placeholder "Search pages…". As user types (debounced ~150ms), call `db:pages:search` with query and limit (default 20).
- [x] **Results rendering**: Display results as a list with:
  - Page title (highlighted match)
  - Snippet from content (backend `buildSearchSnippet()`, the FTS5 `snippet()` stand-in) with match highlights
  - Page icon
  - Parent page breadcrumb (e.g., "Folder > Subfolder > Page")
- [x] **Navigation**: Clicking a result (or Enter) navigates to `/notes/:pageId` and closes the palette. Sidebar highlights the page.
- [x] **Dedicated search results view**: A `/notes/search?q=...` route showing the full results list (limit 50). Accessible from the palette "View all" action. Pagination not implemented.
- [x] **Recent pages fallback**: When search input is empty, show recently updated pages (from `db:pages:tree`, max 10).
- [x] **Keyboard navigation in palette**: ↑/↓ to select result, Enter to open, Escape to close. Focus management: input focused on open, previous focus restored on close.
- [x] **Search ranking**: Backend ranks title matches ahead of content-only matches, then by `updated_at DESC`. (Stand-in for FTS5 `bm25()`, which is unavailable — see Implementation Status.)
- [x] **Case-insensitive matching**: `LIKE` is case-insensitive for ASCII. User input is matched literally (wildcards escaped); FTS5 prefix syntax is unavailable.
- [x] **Debouncing & cancellation**: Search IPC is debounced (150ms). Stale responses are dropped via a monotonic sequence guard.
- [x] **Performance**: Single sequential `LIKE` query over the (small) pages set; debounce + catalog caching keep the palette responsive.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [x] **Global vs. scoped**: Command palette is global (works from Assignments view too). Results only show pages (not assignments). Future: unified search across assignments + pages.
- [x] **Palette UI**: Centered modal overlay with backdrop. Max height ~60% viewport. Scrollable results. Close on Escape, click backdrop, or navigation.
- [x] **Snippet generation**: Backend returns a highlighted snippet (`buildSearchSnippet()` — the FTS5 `snippet()` stand-in). Frontend sanitizes via `createSafeHtml` and renders `<mark>` highlights.
- [x] **Breadcrumb**: Ancestry path (parent > grandparent > page) computed on the frontend from the page tree catalog.
- [x] **No results state**: Show "No pages found for 'query'" with a link back to Notes.
- [x] **Accessibility**: Palette uses `role="dialog"`, `aria-modal="true"`, `aria-label="Search pages"`. Input uses `role="combobox"` + `aria-activedescendant`; results list uses `role="listbox"`, items `role="option"`. Focus trap within palette.
- [x] **Index maintenance**: N/A — the `LIKE`-based search has no separate index/triggers to maintain (the FTS5 triggers described in Ticket 3.11 were removed for the same sql.js reason).
- [x] **Search scope**: MVP searches `title` and `content` columns. Future: search tags, filter by date, filter by parent folder.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File                                                  | Change                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/frontend/src/components/notes/SearchPalette.tsx` | **New file**. Command palette modal: input, results list, keyboard nav, focus trap, recent pages fallback.               |
| `src/frontend/src/pages/NotesSearchResults.tsx`       | **New file** (optional). Dedicated search results page at `/notes/search?q=...` for long result sets.                    |
| `src/frontend/src/hooks/usePageSearch.ts`             | **New file**. Hook for debounced search, AbortController management, recent pages cache, keyboard shortcut registration. |
| `src/frontend/src/components/notes/NotesSidebar.tsx`  | Add "Search" button in sidebar header that opens palette.                                                                |
| `src/frontend/src/hooks/useGlobalShortcuts.ts`        | **New file** (or extend). Register `Cmd+K` / `Ctrl+K` globally (when not in text input) to open palette.                 |
| `src/frontend/src/stores/notesStore.ts`               | Add search state: `query`, `results`, `isSearching`, `recentPages`.                                                      |

### Backend (verify IPC)

| File                                | Change                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/main/db/repository.ts` | Verify `searchPages(query, limit)` uses FTS5: `SELECT p.*, bm25(pages_fts) as rank, snippet(pages_fts, ...) as snippet FROM pages_fts JOIN pages p ON pages_fts.id = p.id WHERE pages_fts MATCH ? ORDER BY rank LIMIT ?`. |
| `src/backend/main/ipc-handlers.ts`  | Verify `db:pages:search` handler calls repository and returns `PageSearchResult[]`.                                                                                                                                       |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [x] **Palette opens**: Cmd+K / Ctrl+K opens palette from any view (Assignments, Notes, Settings).
- [x] **Search works**: Typing in palette calls `db:pages:search` → results appear with title, snippet, icon, breadcrumb.
- [x] **Ranking correct**: Results ordered by relevance (title match before content match).
- [x] **Snippets highlight**: Matching terms wrapped in `<mark>` in snippet, rendered with highlight style.
- [x] **Navigation**: Click/Enter on result → navigates to `/notes/:pageId` → palette closes → sidebar highlights page.
- [x] **Keyboard nav**: ↑/↓ selects, Enter opens, Escape closes. Focus restored on close.
- [x] **Recent pages**: Empty query shows recently updated pages (max 10).
- [x] **Debounce**: Rapid typing sends only 1 request per ~150ms. Previous requests cancelled (stale responses dropped).
- [x] **No results**: Shows helpful empty state.
- [x] **Dedicated view**: `/notes/search?q=...` shows results (no pagination).
- [x] **Global shortcut disabled in inputs**: Cmd+K doesn't open palette when focused in a text input/textarea (editor, search input itself).
- [x] **Performance**: Search feels instant for typical queries.
- [x] **TypeScript compiles**: `pnpm typecheck` passes.
- [x] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **FTS5 query syntax**: User input passed to `MATCH` should be sanitized. Escape FTS5 special characters (`"`, `*`, `-`, `+`, `(`, `)`) or wrap in quotes for phrase search. For MVP: simple prefix matching — append `*` to each term: `"hello world" → "hello* world*"`.
- **AbortController pattern**:
  ```ts
  const abortRef = useRef<AbortController>();
  const search = async (query) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const results = await api.db.pages.search(
      { query, limit: 20 },
      { signal: abortRef.current.signal },
    );
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

Full-text search across pages with a Cmd+K palette, relevance ranking, snippet highlights, breadcrumbs, and keyboard navigation.
