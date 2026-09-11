---
applyTo: 'docs/tickets/phase3/phase3-11-notes-pages-schema.md'
issue: 'N/A'
---

# phase3-11-notes-pages-schema — Pages Table Schema & IPC

## Description

Create the `pages` table and full IPC surface for the standalone Notes workspace (Notion-style). Pages are independent of assignments — they form a hierarchical knowledge base with nested pages, rich content, and full-text search. This ticket covers the **backend data layer only** (schema, repository, IPC, preload, migration). Frontend tickets (3.12–3.16) build on this foundation.

This is a **blocking prerequisite** for Tickets 3.12–3.16.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Schema**: Create `pages` table with columns per `docs/architecture/data-model.md`:
  - `id` (TEXT PK, UUID)
  - `parent_id` (TEXT, nullable, self-referential FK → `pages.id` ON DELETE CASCADE for subtree deletion)
  - `title` (TEXT NOT NULL)
  - `content` (TEXT, nullable — Markdown for MVP; JSON for future block editor)
  - `icon` (TEXT, nullable — emoji or identifier)
  - `cover` (TEXT, nullable — future cover image/color)
  - `position` (INTEGER NOT NULL DEFAULT 0 — display order among siblings)
  - `created_at` (INTEGER NOT NULL — Unix epoch ms UTC)
  - `updated_at` (INTEGER NOT NULL — Unix epoch ms UTC)
  - `created_by` (TEXT, nullable — future multi-user)
- [ ] **Indexes**: 
  - PK on `id`
  - `idx_pages_parent` on `pages(parent_id, position)` for fast sibling ordering
  - `idx_pages_updated` on `pages(updated_at DESC)` for recent pages
  - **FTS5 virtual table** `pages_fts` on `pages(id, title, content)` for full-text search (Ticket 3.14)
- [ ] **Migration**: Create migration file (next version after Phase 3 audit migration) that creates the `pages` table, indexes, and FTS5 virtual table with triggers to keep FTS in sync on INSERT/UPDATE/DELETE.
- [ ] **Repository**: Add methods in `src/backend/main/db/repository.ts`:
  - `listPages(parentId?: string): Promise<Page[]>` — children of `parentId` (or roots if null), ordered by `position`
  - `getPage(id: string): Promise<Page | null>`
  - `getPageTree(): Promise<PageTreeNode[]>` — full hierarchical tree for sidebar (recursive CTE or application-side assembly)
  - `createPage(input: PageInput): Promise<Page>`
  - `updatePage(input: PageUpdateInput): Promise<Page>`
  - `deletePage(id: string): Promise<void>` — cascades to children via FK
  - `movePage(id: string, parentId: string | null, position: number): Promise<Page>`
  - `searchPages(query: string, limit?: number): Promise<PageSearchResult[]>` — uses FTS5
- [ ] **IPC Channels**: Implement in `src/backend/main/ipc-handlers.ts` per `docs/architecture/ipc-contract.md`:
  - `db:pages:list` — `{ parentId?: string }` → `Page[]`
  - `db:pages:get` — `string` (id) → `Page | null`
  - `db:pages:tree` — `void` → `PageTreeNode[]`
  - `db:pages:create` — `PageInput` → `Page`
  - `db:pages:update` — `PageUpdateInput` → `Page`
  - `db:pages:delete` — `string` (id) → `void`
  - `db:pages:move` — `{ id: string; parentId: string | null; position: number }` → `Page`
  - `db:pages:search` — `{ query: string; limit?: number }` → `PageSearchResult[]`
- [ ] **Event emission**: Every mutation (create, update, delete, move) emits `db:changed` with `{ table: 'pages', action: 'insert'|'update'|'delete'|'reorder', id: string }` so the sidebar and editor stay in sync.
- [ ] **Preload**: Expose typed `window.api.db.pages.*` in `src/backend/preload/index.ts` matching all channels above. No `any` types.
- [ ] **Types**: Add/verify `Page`, `PageInput`, `PageUpdateInput`, `PageTreeNode`, `PageSearchResult` in `src/backend/shared/types.ts` (should already exist per data-model.md — verify and complete).
- [ ] **Protected fields**: Document in `docs/architecture/data-model.md` that `pages` table is **never touched by iCal import** — it's exclusively user-owned standalone content.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Adjacency list for hierarchy**: Use `parent_id` self-referential FK (adjacency list). It's simple and performant for typical notebook depths (<1000 pages). Do not use closure table or materialized path unless scale demands it.
- [ ] **Cascade delete**: `ON DELETE CASCADE` on `parent_id` FK ensures deleting a parent page deletes its entire subtree. This is the desired behavior (like Notion). Confirm the FK is defined correctly in the migration.
- [ ] **Position management**: `position` is per-sibling (scoped to `parent_id`). When inserting a new page, assign `position = MAX(position) + 1` for that parent. When moving, renumber affected siblings. Repository methods must handle this atomically.
- [ ] **FTS5 triggers**: Create `INSERT`, `UPDATE`, `DELETE` triggers on `pages` to maintain `pages_fts` automatically. Use `content='pages'` FTS5 option or manual triggers. Triggers must handle `title` and `content` fields.
- [ ] **Page tree assembly**: `getPageTree()` can use a recursive CTE (`WITH RECURSIVE`) for efficiency, or fetch all pages and build the tree in TypeScript (simpler, fine for <5000 pages). Prefer CTE for correctness.
- [ ] **Search ranking**: FTS5 `bm25()` ranking for relevance. Return `PageSearchResult = { page: Page; rank: number; snippet?: string }`.
- [ ] **Content format**: Store as **Markdown string** for MVP. The editor (Ticket 3.13) writes Markdown. Future block-based editor (TipTap/Slate) can store JSON in the same `content` column — no schema change needed.
- [ ] **Zero breaking IPC changes**: All new channels are additive. Follow versioning in `docs/architecture/ipc-contract.md`.
- [ ] **Shared types purity**: `src/backend/shared/types.ts` must have zero Electron/Node imports.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Backend — Shared Types

| File | Change |
|------|--------|
| `src/backend/shared/types.ts` | Verify/complete `Page`, `PageInput`, `PageUpdateInput`, `PageTreeNode`, `PageSearchResult` interfaces. Add JSDoc for content format (Markdown MVP). |

### Backend — Database Schema & Migrations

| File | Change |
|------|--------|
| `src/backend/main/db/migrations/005_create_pages_table.ts` (or next version) | **New migration file**. Create `pages` table, indexes, FTS5 virtual table `pages_fts`, and triggers. Update `schema_version`. |
| `src/backend/main/db/schema.ts` | If a central schema file exists, add the `pages` table DDL for reference. |

### Backend — Repository

| File | Change |
|------|--------|
| `src/backend/main/db/repository.ts` | Add all 8 repository methods listed above. Use transactions for multi-step operations (move, delete with cascade). Handle position renumbering. |

### Backend — IPC Handlers

| File | Change |
|------|--------|
| `src/backend/main/ipc-handlers.ts` | Add 8 handlers for `db:pages:*` channels. Wrap in `IpcResult`. Emit `db:changed` events on mutations. Validate inputs (e.g., `parentId` exists if not null, no circular reference on move). |

### Backend — Preload

| File | Change |
|------|--------|
| `src/backend/preload/index.ts` | Expose `window.api.db.pages` with all 8 methods, fully typed. |

### Backend — IPC Contract (Source of Truth)

| File | Change |
|------|--------|
| `src/backend/shared/ipc.ts` | Verify `IpcChannels` includes all 8 `db:pages:*` channels with correct request/response types. |

### Documentation

| File | Change |
|------|--------|
| `docs/architecture/data-model.md` | Confirm `Page` entity table matches implementation. Document protected-fields rule for iCal import. |
| `docs/architecture/ipc-contract.md` | Add `Database — Pages` channel table (should already be there per current doc — verify). |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Migration runs cleanly**: Fresh app install creates `pages` table, indexes, FTS5 table, and triggers. Existing DB upgrades without data loss. `schema_version` increments.
- [ ] **Schema matches types**: SQLite `pages` table columns exactly match `Page` TypeScript interface. FTS5 virtual table exists and is populated.
- [ ] **All IPC channels work**: Each of the 8 `db:pages:*` channels invokable from renderer via `window.api.db.pages.*` and returns correctly typed `IpcResult`.
- [ ] **Preload types exact**: TypeScript compiles with no `any` in preload exposure. `window.api.db.pages.list()` returns `Promise<IpcResult<Page[]>>`, etc.
- [ ] **Events fire**: After any page mutation via IPC, `window.api.onDbChanged` receives `{ table: 'pages', action: 'insert'|'update'|'delete'|'reorder', id: string }`.
- [ ] **Cascade delete works**: Deleting a parent page via `db:pages:delete` removes all descendants (verify via FK cascade).
- [ ] **Move prevents cycles**: `db:pages:move` rejects moving a page into its own descendant (circular reference check).
- [ ] **Position ordering**: Siblings ordered by `position` ASC. Insert assigns next position. Move renumbers correctly.
- [ ] **Tree endpoint works**: `db:pages:tree` returns full hierarchical structure for sidebar rendering.
- [ ] **Search works**: `db:pages:search` returns ranked results from FTS5 with snippets.
- [ ] **Protected fields documented**: `docs/architecture/data-model.md` explicitly states pages are never modified by iCal import.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes across all projects.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **FTS5 availability**: SQLite in Node.js 24 includes FTS5 by default. Verify `PRAGMA compile_options` shows `ENABLE_FTS5` if needed.
- **Trigger approach**: Use `CREATE VIRTUAL TABLE pages_fts USING fts5(id UNINDEXED, title, content, content='pages', content_rowid='rowid')` with `content='pages'` for automatic sync, or manual triggers for more control. Manual triggers are more explicit and avoid FTS5 content= quirks.
- **PageTreeNode shape**: `{ page: Page; children: PageTreeNode[] }` — recursive type for sidebar tree rendering.
- **PageSearchResult shape**: `{ page: Page; rank: number; snippet: string }` — snippet from FTS5 `snippet()` function.
- **Circular reference check on move**: Before moving page A under page B, verify B is not a descendant of A. Can use recursive CTE or fetch ancestors of B.
- **Performance**: For `getPageTree()`, a recursive CTE is ideal:
  ```sql
  WITH RECURSIVE tree AS (
    SELECT *, 0 as depth FROM pages WHERE parent_id IS NULL
    UNION ALL
    SELECT p.*, t.depth + 1 FROM pages p JOIN tree t ON p.parent_id = t.id
  ) SELECT * FROM tree ORDER BY parent_id, position;
  ```
  Then assemble in TypeScript.
- **Test approach**: Unit test repository methods (Vitest in `src/backend/main/__tests__/repository.pages.test.ts`). Integration test IPC handlers via preload bridge in renderer test context.
- **Dependencies**: No new npm dependencies needed for backend (SQLite FTS5 built-in).

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Create pages table with hierarchical nesting, FTS5 search, full IPC (CRUD, tree, move, search), and migration v5.