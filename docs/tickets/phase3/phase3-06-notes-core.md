---
applyTo: 'docs/tickets/phase3/phase3-06-notes-core.md'
issue: 'N/A'
---

# phase3-06-notes-core — Per-Assignment Notes Editor

## Description

Implement the **per-assignment notes editor** in the assignment detail view. Users can add, edit, and delete notes **for a specific assignment** — this is a progress log tied to that assignment (what's done, what's blocked, next steps). Notes support plain text (Markdown rendering deferred to a later phase). The editor is a textarea with save/cancel actions, keyboard shortcuts (Ctrl+Enter to save, Escape to cancel), and optimistic updates with toast on failure. This builds on the data layer from Ticket 3.2 and the note model decision from Ticket 3.0 (1:1 vs 1:N).

> **Distinction from Standalone Pages**: This ticket covers **assignment-scoped notes only** (stored in `notes` table with `assignment_id` FK). The **standalone Notes/Pages workspace** (Notion-style, independent of assignments) is handled in separate tickets: `phase3-11-notes-pages-schema` through `phase3-16-notes-templates`. Those use a separate `pages` table with hierarchical structure, rich text/markdown blocks, and full-text search.

**Prerequisite**: Ticket 3.0 (audit) must be complete — `Note` type, `db:notes:*` IPC channels, and `window.api.db.notes.*` preload bridge verified. Ticket 3.2 (detail data loading) provides the `notes` array in the store.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Notes list display**: In `AssignmentDetailPage`, render a `NotesList` component below the sub-task list (or in a tab/section). Show existing notes in reverse chronological order (newest first) with timestamp and content.
- [ ] **Add note**: Provide an "Add note" button that reveals a `NotesEditor` textarea. Placeholder: "Add a note about this assignment...". Clicking outside or pressing Escape cancels.
- [ ] **Edit note**: Each note entry has an "Edit" button. Clicking it switches that entry to an inline editor (textarea pre-filled with content). Save (Ctrl+Enter) or cancel (Escape).
- [ ] **Delete note**: Each note entry has a "Delete" button with confirmation dialog (same pattern as sub-task delete). Confirm → call `db:notes:delete`.
- [ ] **Save note**: 
  - New note: Ctrl+Enter in textarea → `db:notes:upsert` with `{ assignment_id, content }`.
  - Edit note: Ctrl+Enter → `db:notes:upsert` with `{ assignment_id, content, id }` (if 1:N) or `{ assignment_id, content }` (if 1:1).
  - On success: close editor, show note in list with updated timestamp.
- [ ] **Optimistic UI**: On save, immediately add/update note in local store. If IPC fails, rollback and show error toast: "Failed to save note" with "Retry".
- [ ] **Loading state**: Show skeleton for notes list while loading. Editor shows subtle saving indicator during IPC.
- [ ] **Empty state**: When no notes exist, show "No notes yet — click 'Add note' to start logging progress" with the add button prominent.
- [ ] **Keyboard accessibility**:
  - Tab to "Add note" button → Enter opens editor.
  - In editor: Tab moves focus (not insert tab character — use Shift+Tab or handle specially), Ctrl+Enter saves, Escape cancels.
  - In note entry: Tab to Edit/Delete buttons → Enter activates.
  - Focus management: After save, focus returns to "Add note" button or the edited entry.
- [ ] **Live updates**: Subscribe to `db:changed` for `notes` table. Notes list updates in real-time across windows.
- [ ] **Character count**: Show character count in editor footer (e.g., "247 characters"). Optional max length warning (e.g., 10,000 chars).
- [ ] **Auto-resize textarea**: Textarea grows with content (up to a max height, then scrolls).

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Note model per 3.0 decision**: 
  - If 1:1 (one note per assignment, `assignment_id` is PK): `db:notes:upsert` takes `{ assignment_id, content }`, `db:notes:delete` takes `assignment_id`. List returns `Note | null`.
  - If 1:N (multiple timestamped entries, own `id` PK): `db:notes:upsert` takes `{ id?, assignment_id, content }`, `db:notes:delete` takes `id`. List returns `Note[]`.
  - **This ticket adapts to whichever model 3.0 finalizes**. The UI for 1:N shows a list of entries; for 1:1 it shows a single editor with history (if `created_at`/`updated_at` tracked).
- [ ] **Plain text only (MVP)**: No Markdown rendering, no toolbar. Content stored as plain text. Render with whitespace preservation (`white-space: pre-wrap`). Markdown support can be added later.
- [ ] **Timestamps**: Display `updated_at` (or `created_at` for new entries) in human-readable format: "Updated 2 hours ago", "Created yesterday at 3:45 PM". Use `date-fns` formatDistanceToNow.
- [ ] **Edited indicator**: If `created_at !== updated_at`, show "Edited" badge next to timestamp.
- [ ] **Component structure**: 
  - `NotesList` — container, renders list + add button + empty state.
  - `NoteEntry` — single note display: content, timestamp, edit/delete buttons.
  - `NotesEditor` — textarea + save/cancel + char count + auto-resize.
  - `DeleteConfirmModal` — reuse sub-task delete modal (generic `ConfirmModal`).
- [ ] **Zustand store**: Extend `assignmentDetailStore` (from 3.2) or create `useNotesStore` with `notes`, `addNote`, `updateNote`, `deleteNote`, `optimisticUpdate`, `rollback`. Keep simple — scoped to one assignment.
- [ ] **IPC hook**: `useNotes.ts` with `fetchNotes`, `saveNote`, `deleteNote` wrapping IPC calls, handling `IpcResult`, optimistic updates, toasts.
- [ ] **Reuse ConfirmModal**: Create a generic `ConfirmModal` component (from sub-task delete modal) with props: `title`, `message`, `confirmText`, `cancelText`, `onConfirm`, `onCancel`, `variant: 'destructive' | 'primary'`.
- [ ] **Sanitization**: Notes are plain text — no HTML. But when rendering, escape any HTML entities to prevent XSS if content ever contains `<script>` etc. (defense in depth).

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/components/notes/NotesList.tsx` | **New**. Container: renders `NoteEntry[]` + "Add note" button + empty state. Uses `useNotes` hook. |
| `src/frontend/src/components/notes/NoteEntry.tsx` | **New**. Display: content (`pre-wrap`), timestamp, "Edited" badge, Edit/Delete buttons. `onEdit`, `onDelete` props. |
| `src/frontend/src/components/notes/NotesEditor.tsx` | **New**. Textarea with auto-resize, char count, Ctrl+Enter save, Escape cancel, saving indicator. Props: `initialContent?`, `onSave(content)`, `onCancel`. |
| `src/frontend/src/components/ui/ConfirmModal.tsx` | **New** (or refactor from `DeleteConfirmModal`). Generic confirmation dialog with focus trap, accessible, reusable. |
| `src/frontend/src/stores/notesStore.ts` | **New or extend**. Zustand store for notes per assignment. |
| `src/frontend/src/hooks/useNotes.ts` | **New**. Hook: `fetchNotes(assignmentId)`, `saveNote(assignmentId, content, id?)`, `deleteNote(id)`, `subscribeToChanges(assignmentId)`. |
| `src/frontend/src/pages/AssignmentDetailPage.tsx` | Update: import and render `NotesList` below sub-tasks (or in a tab). Pass `assignmentId`. |
| `src/frontend/src/utils/date.ts` | Add `formatRelativeTime(date)` for "2 hours ago", "Edited" badge logic. |
| `src/frontend/src/utils/sanitize.ts` | Add `escapeHtml(text)` for defense-in-depth rendering. |

### Backend — No Changes Expected

> Assumes Ticket 3.0 audit confirmed backend has `db:notes:list`, `upsert`, `delete` and emits `db:changed`.

| File | Change |
|------|--------|
| *(none expected)* | Verify IPC channels match the note model (1:1 vs 1:N). |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Notes list renders**: Existing notes display in reverse chronological order with content and timestamp.
- [ ] **Add note works**: Click "Add note" → editor opens → type content → Ctrl+Enter saves → note appears in list with timestamp.
- [ ] **Edit note works**: Click "Edit" on a note → inline editor opens → modify → Ctrl+Enter saves → note updates with new timestamp, "Edited" badge shows.
- [ ] **Delete note works**: Click "Delete" → confirmation modal → confirm → note removed immediately (optimistic) → persists after reload.
- [ ] **Optimistic rollback**: Simulate IPC failure on save/delete → rollback, error toast with "Retry".
- [ ] **Retry works**: Click "Retry" on toast → re-sends IPC → succeeds.
- [ ] **Keyboard — Add**: Tab to "Add note" → Enter opens editor → Ctrl+Enter saves → Escape cancels.
- [ ] **Keyboard — Edit**: Tab to "Edit" button → Enter opens editor → Ctrl+Enter saves → Escape cancels.
- [ ] **Keyboard — Delete**: Tab to "Delete" → Enter opens modal → Tab to "Confirm" → Enter deletes.
- [ ] **Empty state**: No notes → shows message + "Add note" button.
- [ ] **Live updates**: Add/edit/delete note in another window → list updates via `db:changed`.
- [ ] **Timestamps**: Show relative time ("2 hours ago"); "Edited" badge when `updated_at > created_at`.
- [ ] **Character count**: Shows in editor footer; warns at max length (if enforced).
- [ ] **Auto-resize**: Textarea grows with content, scrolls after max height.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on 3.0**: The note model (1:1 vs 1:N) determines the IPC payload shapes and UI structure. This ticket must adapt to 3.0's decision. If 3.0 chooses 1:N, the UI shows a list of entries. If 1:1, it shows a single editor with the current note content.
- **Dependency on 3.2**: The `useAssignmentDetail` hook provides the initial `notes` data. The `NotesList` can read from the shared store or have its own store synced via `db:changed`.
- **Ctrl+Enter vs Enter**: Use Ctrl+Enter for save to allow multi-line notes with plain Enter. Document this in the placeholder or a hint.
- **Focus trap in editor**: When editor opens, focus the textarea. On save/cancel, return focus to trigger button.
- **Confirmation modal reuse**: The sub-task delete modal (3.3) should be refactored into a generic `ConfirmModal` used by both. Do this in this ticket or as a quick refactor in 3.3.
- **Testing**:
  - Unit: `useNotes` hook (mock IPC success/failure), `notesStore` actions.
  - Component: `NotesList`, `NoteEntry`, `NotesEditor`, `ConfirmModal` (React Testing Library).
  - E2E: Playwright test in `src/frontend/test/notes.spec.ts` — add, edit, delete, timestamps, persistence, keyboard, live updates.
- **Future**: Markdown rendering (add `remark`/`rehype`), rich text editor, note templates, search within notes, export notes.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Add notes editor to assignment detail: add/edit/delete notes, plain text, timestamps, optimistic UI, live updates, keyboard accessible.