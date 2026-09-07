---
applyTo: 'docs/tickets/phase3/phase3-07-notes-history.md'
issue: 'N/A'
---

# phase3-07-notes-history — Note Ordering & Timestamps

## Description

Polish the notes feature with proper ordering, timestamp display, and edited indicators. This ticket ensures notes are displayed newest-first, timestamps are human-readable and accurate, and users can see when notes were created vs. last edited. It builds on the notes editor from Ticket 3.6 and finalizes the notes UX for Phase 3.

**Prerequisite**: Ticket 3.0 (audit) must have finalized the note model with `created_at` and `updated_at` fields. Ticket 3.6 (notes core) must be functionally complete — add/edit/delete works, optimistic UI, live updates.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Newest-first ordering**: Notes list displays entries sorted by `updated_at` descending (most recently updated first). If 1:1 model, this is trivial (single note). If 1:N, sort the array.
- [ ] **Relative timestamps**: Display `updated_at` as relative time: "Just now", "2 minutes ago", "3 hours ago", "Yesterday at 2:30 PM", "Jan 15 at 10:00 AM". Use `date-fns` `formatDistanceToNow` with `addSuffix: true` for recent, `format` for older.
- [ ] **Absolute timestamp on hover**: Hovering the relative time shows a tooltip with the exact ISO timestamp (e.g., "2026-01-15T22:30:00.000Z").
- [ ] **Edited badge**: If `updated_at > created_at` (by more than a small threshold, e.g., 5 seconds to avoid false positives from rapid save), show an "Edited" badge next to the timestamp.
- [ ] **Created timestamp**: For each note, show "Created" timestamp (relative) in a smaller/secondary style, always visible. On hover, show exact ISO.
- [ ] **Timestamp precision**: Store timestamps with millisecond precision in SQLite (`datetime('now')` gives seconds; use `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` or application-layer `new Date().toISOString()`).
- [ ] **Note grouping by date (optional)**: If many notes exist, group by date with a date header (e.g., "Today", "Yesterday", "January 14"). Defer if low priority.
- [ ] **Keyboard — timestamp focus**: Timestamps are not interactive by default. Optionally, make them focusable (tab stop) to allow screen readers to read the exact time on hover/focus.
- [ ] **Persistence across sync**: Verify that note timestamps are never modified by iCal re-import (protected fields per Ticket 3.8).
- [ ] **Timezone handling**: All timestamps stored as UTC ISO strings. Display in user's local timezone (browser default). No timezone picker needed for MVP.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Sorting in store/hook**: The `useNotes` hook (from 3.6) should return notes pre-sorted by `updated_at` desc. Components just render the array.
- [ ] **Timestamp utility**: Create `src/frontend/src/utils/timestamp.ts` with:
  - `formatRelative(date: string | Date): string` — relative format with thresholds.
  - `formatAbsolute(date: string | Date): string` — exact ISO for tooltip.
  - `isEdited(note: Note): boolean` — `new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 5000`.
- [ ] **Tooltip component**: Reuse or create a simple `Tooltip` component (CSS-only or minimal JS) for hover timestamps. Keep accessible (show on focus too).
- [ ] **Edited badge style**: Small pill badge, muted color, "Edited" text. ARIA: `aria-label="This note was edited after creation"`.
- [ ] **Created timestamp style**: Smaller font, muted color, prefixed with "Created ".
- [ ] **1:1 vs 1:N display**: 
  - If 1:N: List of entries, each with content, updated/created timestamps, edit/delete.
  - If 1:1: Single entry showing current content, with "Last updated" + "Created" timestamps. Edit opens the same editor. History of past versions is NOT stored (out of scope for Phase 3).
- [ ] **No version history**: Phase 3 does not store edit history (diffs, previous versions). Only `created_at` and `updated_at` are tracked. Full version history can be a future enhancement.
- [ ] **Performance**: For assignments with many notes (unlikely in MVP), virtualize the list. Not required for Phase 3.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/frontend/src/hooks/useNotes.ts` | Update: ensure returned `notes` array is sorted by `updated_at` descending. |
| `src/frontend/src/components/notes/NoteEntry.tsx` | Update: display relative `updated_at` with tooltip for absolute, "Edited" badge, relative `created_at`. Use `Tooltip` component. |
| `src/frontend/src/components/notes/NotesList.tsx` | Update: if grouping by date, add date header logic. |
| `src/frontend/src/utils/timestamp.ts` | **New**. `formatRelative`, `formatAbsolute`, `isEdited`, `formatDateHeader` (for grouping). |
| `src/frontend/src/components/ui/Tooltip.tsx` | **New or reuse**. Accessible tooltip: shows on hover/focus, keyboard dismissible, portal to body. |
| `src/frontend/src/utils/date.ts` | Ensure `date-fns` utilities available (already used in 3.5/3.6). |

### Backend — No Changes Expected

> Assumes Ticket 3.0 audit confirmed `created_at` and `updated_at` columns exist and are set correctly (triggers or application-layer).

| File | Change |
|------|--------|
| *(none expected)* | Verify `db:notes:upsert` sets `updated_at = datetime('now')` (or ISO string) on every save. `created_at` set only on insert. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Newest-first**: Notes list shows most recently updated note at top.
- [ ] **Relative timestamps**: "Just now", "5 minutes ago", "2 hours ago", "Yesterday at 3:00 PM", "Jan 10 at 9:00 AM" display correctly.
- [ ] **Hover tooltip**: Hovering relative time shows exact ISO timestamp (e.g., "2026-01-15T22:30:00.000Z").
- [ ] **Edited badge**: Appears on notes where `updated_at > created_at + 5s`. Does not appear on fresh notes.
- [ ] **Created timestamp**: Shows "Created X time ago" for every note, smaller/muted style.
- [ ] **Tooltip on created**: Hovering created timestamp also shows exact ISO.
- [ ] **Timezone**: Timestamps display in local timezone (browser), stored as UTC.
- [ ] **Protected from sync**: Run iCal re-import → note timestamps unchanged.
- [ ] **Keyboard accessible**: Tab to timestamp (if focusable) → tooltip shows on focus.
- [ ] **Sorting in hook**: `useNotes` returns pre-sorted array; components don't sort.
- [ ] **Tooltip accessible**: Shows on focus, dismisses on Escape, `aria-describedby` linked.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Dependency on 3.0**: This ticket requires `created_at` and `updated_at` columns in the `notes` table. If 3.0 audit found them missing, 3.0 must add them via migration before this ticket starts.
- **Dependency on 3.6**: The editor and list must be working. This ticket is a polish pass on top.
- **Timestamp source**: The backend should set `updated_at` on every upsert. Use SQLite trigger or application code:
  ```sql
  CREATE TRIGGER notes_updated_at AFTER UPDATE ON notes
  BEGIN
    UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
  ```
  Or in repository: `updated_at: new Date().toISOString()`.
- **Edited threshold**: 5 seconds avoids false "Edited" on rapid create-then-save. Adjust if needed.
- **1:1 model edge case**: If 1:1, there's only one "entry" but it still has `created_at`/`updated_at`. Show both timestamps on the single note display.
- **Grouping by date**: Nice to have but not required. If implemented, use `formatDateHeader` to group: "Today", "Yesterday", "Mon, Jan 13", etc.
- **Testing**:
  - Unit: `formatRelative`, `formatAbsolute`, `isEdited` with various date inputs (past, future, edge cases).
  - Component: `NoteEntry` renders timestamps, badge, tooltips correctly.
  - E2E: Playwright test in `notes.spec.ts` (extend from 3.6) — create note, edit note, verify timestamps, edited badge, hover tooltips, ordering.
- **Future**: Version history (store diffs), timezone display option, note search/filter.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Polish notes: newest-first ordering, relative timestamps with hover exact time, edited badge, created timestamps, timezone support.