---
applyTo: 'docs/tickets/phase3/phase3-13-notes-editor.md'
issue: 'N/A'
---

# phase3-13-notes-editor — Rich Text / Markdown Editor

## Description

Implement the **page content editor** for the Notes workspace. When a user selects a page in the sidebar (Ticket 3.12), the editor panel opens at `/notes/:pageId` showing the page's content. MVP: **Markdown textarea with live preview (split view) + formatting toolbar**. Future: block-based editor (TipTap/Slate).

The editor must auto-save on change (debounced), support keyboard shortcuts for formatting, and handle the page title/icon/cover metadata.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Editor layout**: Split view (default) with markdown source on left, live preview on right. Toggle buttons: "Edit" (source only), "Split" (default), "Preview" (rendered only). Resizable splitter between panes.
- [ ] **Markdown textarea**:
  - Plain `<textarea>` (no WYSIWYG) for reliability and performance
  - Monospace font, line numbers (optional), syntax highlighting (optional, via CodeMirror 6 or simple tokenization)
  - Tab key inserts 2 spaces (not focus navigation) — configurable
  - Auto-pair brackets, quotes, markdown syntax (**, *, `, [], ())
- [ ] **Live preview**:
  - Render markdown to HTML using `marked` (or `markdown-it`) + DOMPurify sanitization
  - Update on every keystroke (debounced ~150ms) or on blur
  - Scroll sync: preview scrolls to match editor cursor position (approximate)
  - Support GitHub-flavored markdown: tables, task lists (`- [ ]`), strikethrough, code blocks with syntax highlighting
- [ ] **Formatting toolbar** (above editor):
  - Headings (H1–H3 buttons)
  - Bold, Italic, Strikethrough, Inline code
  - Bulleted list, Numbered list, Task list
  - Code block, Blockquote
  - Link (prompt for URL), Image (prompt for URL)
  - Horizontal rule
  - Undo/Redo buttons (or rely on native Ctrl+Z/Ctrl+Shift+Z)
- [ ] **Keyboard shortcuts** (when editor focused):
  - `Ctrl+B` / `Ctrl+I` / `Ctrl+Shift+X` / `Ctrl+\`` for formatting
  - `Ctrl+Shift+1/2/3` for headings
  - `Ctrl+Shift+L` for bulleted list, `Ctrl+Shift+9` for numbered
  - `Ctrl+K` for link, `Ctrl+Shift+K` for image
  - `Ctrl+S` → explicit save (also auto-saves)
  - `Tab` / `Shift+Tab` for indent/outdent in lists
- [ ] **Auto-save**: Debounced (1–2s after last keystroke) call to `db:pages:update` with `{ id, content, updated_at: now() }`. Show "Saving…" / "Saved" indicator in toolbar. On unload (`beforeunload`), flush pending save.
- [ ] **Page metadata editing**:
  - Title: Editable at top of editor (or in sidebar inline rename from Ticket 3.12). Sync with `db:pages:update`.
  - Icon: Emoji picker button next to title (📄, 📁, 📝, ✨, 📚, 🎯, 💡, 📌, custom input).
  - Cover: Placeholder for future (Ticket 3.16 or later).
- [ ] **Page creation flow**: When creating a new page from sidebar (Ticket 3.12), navigate to `/notes/:newPageId` and focus the title field for immediate editing.
- [ ] **Read-only/loading states**: While fetching page, show skeleton. If page not found (deleted externally), show "Page not found" with "Return to Notes" button.
- [ ] **Content persistence**: Content stored as Markdown in `pages.content` column. No conversion needed.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **No heavy editor dependencies for MVP**: Use plain `<textarea>` + `marked` + DOMPurify. Do **not** add CodeMirror, TipTap, Slate, or ProseMirror yet — they add significant bundle size and complexity. Keep MVP lightweight.
- [ ] **Markdown flavor**: GitHub Flavored Markdown (GFM). Use `marked` with `gfm: true, breaks: true`. Add syntax highlighting via `highlight.js` or `shiki` for code blocks (lightweight).
- [ ] **Sanitization**: Always run DOMPurify on rendered HTML before injecting into preview pane. Configure to allow only safe tags (no scripts, iframes, styles).
- [ ] **Split view resizing**: Use CSS `resize: horizontal` on a wrapper, or a draggable splitter component. Persist split ratio in `localStorage`.
- [ ] **Auto-save conflict handling**: If `db:pages:update` fails (e.g., page deleted), show toast and offer to copy content to clipboard. Don't lose user's text.
- [ ] **Concurrent edit detection**: `db:changed` event for `pages` table includes `updated_at`. If remote `updated_at` > local last-saved `updated_at`, show a "Page updated elsewhere — reload?" banner (non-blocking).
- [ ] **Focus management**: On route entry (`/notes/:pageId`), focus the editor textarea (or title if new page). Trap focus in editor when in "Edit" mode? No — keep standard browser focus behavior.
- [ ] **Responsive**: On narrow widths (<1000px), stack editor/preview vertically (preview below) or default to "Edit" mode with preview toggle. Split view only on wider screens.
- [ ] **Empty page**: New pages start with empty content. Optionally insert a template (Ticket 3.16) — if so, pre-fill content on create.
- [ ] **Large content**: Textarea handles large content natively. Preview rendering is on-demand. No virtualization needed for MVP.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File                                                    | Change                                                                                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/pages/NoteEditorPage.tsx`             | **New file**. Page component at `/notes/:pageId`. Fetches page via `db:pages:get`, renders `MarkdownEditor`, handles auto-save, metadata, loading/error states. |
| `src/frontend/src/components/notes/MarkdownEditor.tsx`  | **New file**. Main editor component: toolbar, split view (textarea + preview), keyboard shortcuts, scroll sync, view mode toggle.                               |
| `src/frontend/src/components/notes/MarkdownToolbar.tsx` | **New file**. Formatting buttons with icons, keyboard shortcut hints, view mode toggles, save status indicator.                                                 |
| `src/frontend/src/components/notes/MarkdownPreview.tsx` | **New file**. Preview pane: renders sanitized HTML from markdown, handles scroll sync, code highlighting.                                                       |
| `src/frontend/src/hooks/useMarkdownEditor.ts`           | **New file**. Hook for editor state: content, view mode, split ratio, auto-save timer, dirty flag, keyboard shortcuts.                                          |
| `src/frontend/src/hooks/usePageEditor.ts`               | **New file**. Hook for page-level logic: fetch page, auto-save via `db:pages:update`, handle `db:changed` events, title/icon updates.                           |
| `src/frontend/src/utils/markdown.ts`                    | **New file**. `parseMarkdown(md: string): string` (HTML), `sanitizeHtml(html: string): string`, `highlightCodeBlocks(html: string): string`.                    |
| `src/frontend/src/utils/emojiPicker.ts`                 | **New file**. Simple emoji picker component for page icon (grid of common emojis + custom input).                                                               |
| `src/frontend/src/stores/notesStore.ts`                 | Extend with editor state: `content`, `isDirty`, `lastSavedContent`, `viewMode`, `splitRatio`.                                                                   |

### Dependencies

| Package                   | Reason                                                  |
| ------------------------- | ------------------------------------------------------- |
| `marked`                  | Markdown parsing (GFM support)                          |
| `dompurify`               | HTML sanitization (already added for Ticket 3.1)        |
| `highlight.js` or `shiki` | Code block syntax highlighting in preview (lightweight) |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Editor opens**: Navigating to `/notes/:pageId` loads page content into editor.
- [ ] **Split view works**: Textarea left, preview right, resizable splitter, persists ratio.
- [ ] **View modes**: "Edit" (source only), "Split" (default), "Preview" (rendered only) toggle correctly.
- [ ] **Markdown renders**: GFM renders correctly (headings, lists, tables, code blocks, task lists, links, images, blockquotes, HR).
- [ ] **Syntax highlighting**: Code blocks show language-appropriate highlighting in preview.
- [ ] **Toolbar works**: Clicking buttons inserts correct markdown at cursor position (or wraps selection).
- [ ] **Keyboard shortcuts**: All listed shortcuts work when editor focused.
- [ ] **Auto-save**: Typing stops → 1-2s later → `db:pages:update` called → "Saved" indicator shows. No data loss on rapid typing.
- [ ] **Explicit save**: Ctrl+S triggers immediate save.
- [ ] **Title/icon edit**: Changing title/icon in editor calls `db:pages:update` → sidebar updates.
- [ ] **New page flow**: Create from sidebar → navigates to editor → title focused → type to edit.
- [ ] **Concurrent edit banner**: If page updated externally, non-blocking banner appears offering reload.
- [ ] **Error handling**: Save failure → toast + content preserved in textarea.
- [ ] **Sanitization**: Malicious HTML in markdown (e.g., `<script>`, `<iframe>`, `onclick`) is stripped in preview.
- [ ] **Responsive**: On narrow screen, stacks vertically or defaults to Edit mode.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on 3.11 + 3.12**: Needs `db:pages:get`/`update` IPC and sidebar navigation to `/notes/:pageId`.
- **Marked config**:
  ```ts
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: (code, lang) => hljs.highlightAuto(code, [lang]).value,
  });
  ```
- **DOMPurify config**:
  ```ts
  DOMPurify.sanitize(html, { ALLOWED_TAGS: [...], ALLOWED_ATTR: [...] });
  ```
- **Auto-save implementation**: Use `useRef` for timeout ID, `useEffect` for cleanup. Compare `content` vs `lastSavedContent` before sending IPC.
- **Scroll sync**: Approximate — map textarea `scrollTop` to preview `scrollTop` ratio. Or use `codemirror` for proper sync (deferred).
- **Playwright tests**: `src/frontend/test/note-editor.spec.ts`. Test: render, toolbar, shortcuts, auto-save, split view, preview accuracy, sanitization, concurrent edit banner, new page flow.
- **Bundle size**: `marked` (~35kb), `dompurify` (~25kb), `highlight.js` (~40kb) — acceptable for MVP. Avoid heavier editors.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Markdown editor with split view, live preview, toolbar, keyboard shortcuts, auto-save, and syntax highlighting.
