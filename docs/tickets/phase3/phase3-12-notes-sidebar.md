---
applyTo: 'docs/tickets/phase3/phase3-12-notes-sidebar.md'
issue: 'N/A'
---

# phase3-12-notes-sidebar — Notes Sidebar & Navigation

## Description

Build the collapsible **Notes Sidebar** (left panel) for the standalone Notes workspace. The sidebar displays the hierarchical page tree, supports drag-and-drop reordering and nesting, and provides page/folder creation, renaming, deletion, and duplication. This is the primary navigation UI for the Notes workspace (Tickets 3.13–3.16 build on it).

**Prerequisite**: Ticket 3.11 (Pages Schema & IPC) must be complete — the sidebar consumes `db:pages:tree`, `db:pages:create`, `db:pages:update`, `db:pages:delete`, `db:pages:move` IPC channels.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Sidebar layout**: Add a resizable left sidebar (default width ~280px, min 200px, max 400px) to the app layout. The sidebar is visible in the Notes workspace (new route `/notes` or `/notes/:pageId`). Consider a top-level navigation toggle (e.g., "Assignments" | "Notes" in the TopBar) to switch between the Assignment List and Notes workspace.
- [ ] **Page tree rendering**: Fetch full tree via `window.api.db.pages.tree()` on mount. Render as a nested tree with:
  - Page title + icon (emoji from `page.icon` or default 📄)
  - Expand/collapse chevron for pages with children
  - Indentation per depth level (e.g., 16px per level)
  - Visual indication of current/active page (highlighted row)
- [ ] **Drag-and-drop reordering & nesting**: Use `@dnd-kit/core` + `@dnd-kit/sortable` (already added in Phase 2) to enable:
  - Reorder siblings (drag up/down within same parent)
  - Nest/unnest (drag left/right or drop onto a page to make it a child)
  - Visual drop indicators (insertion line, highlight target parent)
  - On drop, call `db:pages:move` with new `parentId` and `position`
- [ ] **Page actions** (context menu or inline icons on hover):
  - **New page**: Create sibling (same parent) or child (nested under selected page) → `db:pages:create` → select new page
  - **New folder**: Same as page but with a folder icon (just a page with `icon: "📁"` and no content)
  - **Rename**: Inline edit title (Enter to save, Escape to cancel) → `db:pages:update`
  - **Duplicate**: Deep copy page + all descendants → `db:pages:create` recursively → select duplicate
  - **Delete**: Confirm dialog → `db:pages:delete` (cascades to children) → select nearest sibling or parent
- [ ] **Keyboard navigation**: Full keyboard support without mouse:
  - ↑/↓: Navigate tree (skip collapsed children)
  - ←/→: Collapse/expand or unnest/nest (when focused on chevron)
  - Enter: Open page in editor (navigate to `/notes/:pageId`)
  - F2 / Ctrl+R: Rename
  - Delete: Delete with confirmation
  - Ctrl+D: Duplicate
  - Ctrl+N: New child page
  - Ctrl+Shift+N: New sibling page
- [ ] **Persisted expanded state**: Store expanded/collapsed state per page ID in `localStorage` (or settings table) so it survives reloads. Restore on mount.
- [ ] **Live updates**: Subscribe to `window.api.onDbChanged` for `pages` table. On `insert`/`update`/`delete`/`reorder`, update the tree optimistically or refetch tree. Handle concurrent edits gracefully.
- [ ] **Empty state**: When no pages exist, show a friendly empty state with "Create your first page" CTA button.
- [ ] **Loading state**: Skeleton/tree placeholder while `db:pages:tree` loads.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Route structure**: Notes workspace at `/notes` (shows welcome/empty) and `/notes/:pageId` (opens page in editor). Sidebar persists across both routes. Consider a layout wrapper that provides the sidebar + editor split view.
- [ ] **Top-level navigation**: Add a view switcher in the TopBar (Phase 1/2): "Assignments" (default) | "Notes". Clicking "Notes" navigates to `/notes`. The Assignment List remains at `/` (or `/assignments`).
- [ ] **Drag-drop constraints**:
  - Cannot drop a page into its own descendant (circular ref) — validator in backend (Ticket 3.11) but show immediate feedback in UI too.
  - Dropping on a page = make it a child (nested). Dropping between pages = reorder as sibling.
  - Use `@dnd-kit`'s `closestCorners` or `pointerWithin` collision detection for nesting intent.
- [ ] **Folder vs. page**: No separate "folder" entity. A folder is just a page with `icon: "📁"` (or user-chosen) and optionally empty content. Treat uniformly in the tree.
- [ ] **Icon picker**: MVP: hardcoded emoji picker (📄, 📁, 📝, ✨, 📚, etc.) on create/rename. Future: custom emoji input.
- [ ] **Responsive**: Sidebar collapses to icon-only on narrow widths (<1000px) or via a toggle button. Minimum app width 800px (Phase 1).
- [ ] **Focus management**: On page open, focus moves to editor (Ticket 3.13). On delete, focus moves to next sibling or parent. On create, focus the new page's title for inline rename.
- [ ] **Concurrent edits**: If another window/process modifies the tree, `db:changed` event fires. Refetch tree or apply minimal diff. For MVP, refetch full tree on any `pages` event (simple, fast for <1000 pages).
- [ ] **Accessibility**: Tree follows ARIA tree pattern (`role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-level`, `aria-setsize`, `aria-posinset`). Keyboard navigation per APG tree view pattern.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/routes.tsx` | Add `/notes` and `/notes/:pageId` routes. Create a `NotesLayout` wrapper that renders Sidebar + Editor outlet. |
| `src/frontend/src/pages/NotesWorkspace.tsx` | **New file**. Top-level page for Notes workspace. Renders `NotesSidebar` + `Outlet` for editor. |
| `src/frontend/src/components/notes/NotesSidebar.tsx` | **New file**. Main sidebar component: fetches tree, renders `PageTree`, handles DnD, actions, keyboard nav. |
| `src/frontend/src/components/notes/PageTree.tsx` | **New file**. Recursive tree rendering component. Renders `PageTreeNode` for each page. |
| `src/frontend/src/components/notes/PageTreeNode.tsx` | **New file**. Single node: title, icon, chevron, drag handle, context menu, inline rename. |
| `src/frontend/src/components/notes/PageActions.tsx` | **New file**. Context menu (right-click) or hover action bar: new child, new sibling, rename, duplicate, delete. |
| `src/frontend/src/hooks/usePageTree.ts` | **New file**. Hook to fetch tree via IPC, subscribe to `db:changed`, manage expanded state in `localStorage`, provide DnD handlers. |
| `src/frontend/src/hooks/usePageActions.ts` | **New file**. Hook for create/rename/duplicate/delete/move mutations with optimistic updates. |
| `src/frontend/src/stores/notesStore.ts` | **New file** (or extend existing Zustand store). Tree data, expanded state, active page ID, drag state. |
| `src/frontend/src/components/TopBar.tsx` | Add "Notes" view switcher button (icon + label) that navigates to `/notes`. |
| `src/frontend/src/utils/dnd.ts` | Extend Phase 2 DnD utilities for tree-specific logic (nesting detection, position calculation). |

### Backend (if any IPC adjustments needed)

| File | Change |
|------|--------|
| `src/backend/main/ipc-handlers.ts` | Verify `db:pages:move` validates circular refs and returns updated page. No new channels needed. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Sidebar renders**: Tree loads and displays correctly with icons, chevrons, indentation.
- [ ] **Expand/collapse**: Clicking chevron toggles children visibility. State persists in `localStorage` across reloads.
- [ ] **Drag-drop reorder**: Drag a page up/down among siblings → order updates → `db:pages:move` called → tree reflects new order.
- [ ] **Drag-drop nest**: Drag page onto another page → becomes child → `db:pages:move` with new `parentId` → tree reflects nesting.
- [ ] **Drag-drop unnest**: Drag child page out to root level or between top-level pages → becomes sibling/root → tree reflects change.
- [ ] **Create page**: "New page" creates sibling; "New child page" creates child. New page appears in tree, title focused for rename.
- [ ] **Create folder**: Creates page with folder icon (📁). Behaves identically to page.
- [ ] **Rename**: Inline edit (F2 or click title) → Enter saves → `db:pages:update` called → tree updates.
- [ ] **Duplicate**: Ctrl+D or context menu → deep copy of page + descendants → new tree entries with "Copy of " prefix → original unaffected.
- [ ] **Delete**: Confirm dialog → `db:pages:delete` → page and all descendants removed → focus moves to next sibling/parent.
- [ ] **Keyboard nav**: All shortcuts work (↑/↓/←/→/Enter/F2/Delete/Ctrl+D/Ctrl+N/Ctrl+Shift+N). Focus visible at all times.
- [ ] **Active page highlight**: Page matching `/notes/:pageId` route is highlighted in sidebar.
- [ ] **Empty state**: No pages → shows "Create your first page" button that creates a root page.
- [ ] **Live updates**: Creating/updating/deleting a page in another window (or via IPC directly) updates the tree within ~200ms.
- [ ] **View switcher**: TopBar "Notes" button navigates to `/notes`; "Assignments" returns to list.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on 3.11**: This ticket cannot start until 3.11's IPC channels are implemented and working. Verify `window.api.db.pages.tree()` etc. exist before beginning.
- **Zustand store design**: Consider a `notesStore` with `{ tree: PageTreeNode[]; expanded: Set<string>; activePageId: string | null; dragState: ... }`. Actions: `setTree`, `toggleExpanded`, `setActivePage`, `optimisticMove`, `applyRemoteChange`.
- **Optimistic updates**: For DnD, update the tree immediately in Zustand, then call `db:pages:move`. On success, confirm. On failure, revert and toast error.
- **PageTreeNode vs Page**: `PageTreeNode = { page: Page; children: PageTreeNode[] }`. The recursive component renders this structure.
- **DnD with @dnd-kit**: Phase 2 added `@dnd-kit` for assignment list. Reuse the same pattern. Use `SortableContext` with `verticalListSortingStrategy` for siblings, custom strategy for tree nesting.
- **Circular ref prevention**: Backend validates, but UI should also prevent dropping into own subtree (disable drop zones on self and descendants during drag).
- **Playwright tests**: New e2e tests in `src/frontend/test/notes-sidebar.spec.ts`. Test: tree render, expand/collapse, DnD reorder/nest/unnest, create/rename/duplicate/delete, keyboard nav, empty state, live updates.
- **Performance**: For large trees (>1000 pages), consider virtualized tree rendering (react-window or similar). MVP: simple recursive render is fine.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Build Notes sidebar with hierarchical page tree, drag-drop reorder/nest, create/rename/duplicate/delete, keyboard nav, live updates.