---
applyTo: 'docs/tickets/phase3/phase3-09-accessibility.md'
issue: 'N/A'
---

# phase3-09-accessibility — Accessibility & Keyboard Navigation

## Description

Ensure all Phase 3 UI (detail view, sub-tasks, notes, progress indicator, all-complete prompt) meets WCAG 2.1 AA standards and provides full keyboard navigation. This ticket audits and fixes accessibility gaps across the new components, establishes consistent patterns, and adds automated accessibility testing to the CI pipeline.

**Prerequisite**: Tickets 3.1 (detail route), 3.3 (sub-task list), 3.4 (sub-task toggle), 3.5 (progress), 3.6 (notes), 3.7 (notes history) should be functionally complete. This ticket polishes them for accessibility.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Keyboard navigation — Detail view**:
  - Tab order: Back button → Assignment title → Course badge → Due date → Status badge → Description → Progress bar → Sub-task list (each row: checkbox → title → delete) → Add sub-task input → Notes editor → Note entries.
  - Enter/Space activates buttons, links, checkboxes.
  - Escape closes modals (delete confirmation, any dialogs), clears inputs.
  - Arrow keys navigate within composite widgets (e.g., sub-task list rows if roving tabindex used).
- [ ] **Keyboard navigation — Sub-tasks** (verify from 3.3/3.4):
  - Tab through checkbox, title (if editable), delete button.
  - Space/Enter on checkbox toggles completion.
  - Enter in add input saves.
  - Delete key on focused row opens delete confirmation (optional shortcut).
- [ ] **Keyboard navigation — Notes** (verify from 3.6/3.7):
  - Tab to notes editor → Enter to save (or Ctrl+Enter for multi-line), Escape to cancel.
  - Tab through note entries (read-only) with timestamp focusable.
  - Delete note button accessible via keyboard.
- [ ] **Keyboard navigation — All-complete prompt** (verify from 3.5):
  - Tab to "Mark Complete" button → Enter activates.
  - Tab to "Dismiss" link → Enter activates.
  - Escape dismisses prompt (same as Dismiss).
- [ ] **Focus management**:
  - On route entry (`/assignments/:id`), focus the first focusable element (Back button).
  - On return to list (Back button or browser back), restore focus to the assignment row that was clicked.
  - On modal open (delete confirmation), trap focus inside modal; on close, return focus to trigger element.
  - On optimistic add (sub-task/note), keep focus in the input for rapid entry.
- [ ] **Focus visible**: All interactive elements have a visible focus ring (2px minimum, high contrast) per `:focus-visible` CSS.
- [ ] **ARIA — Progress bar** (from 3.5): `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label` with "Sub-task progress: X of Y complete, Z percent".
- [ ] **ARIA — Sub-task checkbox**: Native `<input type="checkbox">` (preferred) or `role="checkbox"` with `aria-checked`, `aria-label` referencing sub-task title.
- [ ] **ARIA — Delete buttons**: `aria-label="Delete sub-task: {title}"` or `aria-label="Delete note: {preview}"`.
- [ ] **ARIA — Notes editor**: `aria-label="Notes for {assignment title}"`, `aria-multiline="true"` if textarea.
- [ ] **ARIA — All-complete prompt**: `role="status"` or `aria-live="polite"` for announcement; buttons have accessible names.
- [ ] **ARIA — Detail page landmarks**: `<main>`, `<nav>` for back link, `<section aria-labelledby="assignment-title">` for content areas.
- [ ] **Color contrast**: All text meets 4.5:1 (normal) / 3:1 (large) against background. Progress bar track/fill meets 3:1 against adjacent colors. Focus ring meets 3:1 against background.
- [ ] **Reduced motion**: All animations/transitions (progress bar, toggle, modal fade) respect `prefers-reduced-motion: reduce` — disable or instant.
- [ ] **Screen reader testing**: Test with NVDA (Windows) / VoiceOver (macOS) / Orca (Linux) — verify all content announced logically, no duplicate announcements, form labels associated.
- [ ] **Zoom support**: UI remains usable at 200% browser zoom (no horizontal scrolling at 800px viewport, no content overlap).
- [ ] **Automated a11y testing**: Add `axe-core` / `@axe-core/playwright` to Playwright E2E tests. Run on detail page, sub-task list, notes editor. Fail CI on violations.
- [ ] **Document keyboard shortcuts**: Add a "Keyboard Shortcuts" help modal (or section in Settings) listing: `Alt+Up/Down` (priority reorder, Phase 2), `Enter` (open detail), `Space/Enter` (toggle sub-task), `Escape` (close modal/clear input), `Tab` (navigate).

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Native elements first**: Use `<button>`, `<a>`, `<input type="checkbox">`, `<textarea>`, `<select>` instead of custom `div`/`span` widgets. Native elements provide keyboard/ARIA for free.
- [ ] **Focus trap for modals**: Implement a reusable `FocusTrap` component (or use `focus-trap-react`) for delete confirmation modal and any future dialogs.
- [ ] **Focus restoration**: Store `lastFocusedElement` before navigation/modal; restore on close/back. Use a small utility hook `useFocusRestoration()`.
- [ ] **Roving tabindex for lists**: For sub-task list, consider roving tabindex (one `tabIndex=0` at a time, arrow keys move it) if list is long. For Phase 3, simple `tabIndex=0` on each interactive element is acceptable.
- [ ] **Live regions for dynamic content**: Use `aria-live="polite"` for progress updates, all-complete prompt, toast notifications. Use `aria-live="assertive"` for errors.
- [ ] **No ARIA overuse**: Don't add `role="button"` to `<button>`, `aria-label` when visible label exists. Only add ARIA where native semantics are insufficient.
- [ ] **Consistent focus ring**: Define a global CSS focus ring style (e.g., `--focus-ring: 2px solid var(--color-focus); outline: var(--focus-ring); outline-offset: 2px;`) and apply via `:focus-visible`.
- [ ] **Skip link**: Add a "Skip to main content" link at top of detail page (hidden until focused) for keyboard users to bypass navigation.
- [ ] **Heading hierarchy**: Detail page uses `<h1>` for assignment title, `<h2>` for "Sub-tasks", "Notes", "Progress" sections. No skipped levels.
- [ ] **Language attribute**: Ensure `<html lang="en">` (or user's locale) is set in `index.html`.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer) — Components

| File                                                          | Change                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/frontend/src/pages/AssignmentDetailPage.tsx`             | Audit: heading hierarchy, landmarks, skip link, focus on mount, focus restoration on back. Add `autoFocus` to Back button or use `useEffect` to focus. |
| `src/frontend/src/components/subtasks/SubTaskRow.tsx`         | Verify: native checkbox, `aria-label` on delete button, focus styles, keyboard activation.                                                             |
| `src/frontend/src/components/subtasks/SubTaskAddInput.tsx`    | Verify: native input, `aria-label`, Enter to save, Escape to clear, focus on mount.                                                                    |
| `src/frontend/src/components/subtasks/DeleteConfirmModal.tsx` | Add: `FocusTrap`, initial focus on "Cancel" button, `aria-modal="true"`, `role="dialog"`, `aria-labelledby`, Escape to close, focus restoration.       |
| `src/frontend/src/components/subtasks/AllCompletePrompt.tsx`  | Verify: `role="status"` or `aria-live="polite"`, button/link focusable, Escape dismisses.                                                              |
| `src/frontend/src/components/notes/NotesEditor.tsx`           | Verify (from 3.6/3.7): `textarea` with `aria-label`, `aria-multiline`, Ctrl+Enter to save, Escape to cancel, focus management.                         |
| `src/frontend/src/components/notes/NoteEntry.tsx`             | Verify: timestamp focusable, delete button `aria-label`, read-only content announced.                                                                  |
| `src/frontend/src/components/ui/ProgressBar.tsx`              | Verify (from 3.5): `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`, reduced motion.                              |
| `src/frontend/src/components/assignments/AssignmentRow.tsx`   | Verify: clickable row has `tabIndex=0`, `role="button"` (if not native), focus ring, Enter/Space opens detail.                                         |
| `src/frontend/src/components/ui/Toast.tsx`                    | Verify: `role="status"`, `aria-live="polite"`, focusable dismiss button.                                                                               |

### Frontend — Hooks / Utilities

| File                                                      | Change                                                                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/hooks/useFocusRestoration.ts`           | **New**. Hook: `const { saveFocus, restoreFocus } = useFocusRestoration()`. Saves `document.activeElement` before navigation/modal, restores after. |
| `src/frontend/src/hooks/useFocusTrap.ts`                  | **New or reuse**. Hook/component for focus trapping in modals.                                                                                      |
| `src/frontend/src/utils/keyboard.ts`                      | **New or extend**. Key constants, `isActivationKey(event)` (Enter/Space), `isEscapeKey(event)`, `isArrowKey(event)`.                                |
| `src/frontend/src/styles/global.css` (or CSS-in-JS theme) | Add global `:focus-visible` style, skip link styles, reduced-motion media query overrides.                                                          |

### Frontend — Testing

| File                                            | Change                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/test/a11y.spec.ts`                | **New**. Playwright + `@axe-core/playwright` tests: scan detail page, sub-task list, notes editor, modals. Configure to fail on violations. |
| `src/frontend/test/keyboard-navigation.spec.ts` | **New**. Playwright tests for Tab order, focus management, keyboard shortcuts, focus restoration.                                           |

### Documentation

| File                                 | Change                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/architecture/accessibility.md` | **New or update**. Document accessibility standards, focus management patterns, ARIA usage guidelines, keyboard shortcuts reference. |
| `README.md` (root)                   | Add accessibility statement / keyboard shortcuts link.                                                                               |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Tab order correct**: Tabbing through detail page follows logical visual order (Back → title → meta → description → progress → sub-tasks → add input → notes → note entries).
- [ ] **All interactive elements keyboard accessible**: Buttons, links, checkboxes, inputs, delete buttons all reachable and activatable via keyboard.
- [ ] **Focus visible**: Clear focus ring on all interactive elements (2px, high contrast).
- [ ] **Focus management — route entry**: On `/assignments/:id` load, Back button focused.
- [ ] **Focus management — back navigation**: Returning to list restores focus to originating row.
- [ ] **Focus management — modals**: Delete confirmation traps focus; close restores focus to delete button.
- [ ] **Focus management — optimistic add**: After adding sub-task/note, focus stays in input.
- [ ] **ARIA — Progress bar**: Correct `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, descriptive `aria-label`.
- [ ] **ARIA — Sub-task checkbox**: Native checkbox or proper `role="checkbox"` with `aria-checked`.
- [ ] **ARIA — Delete buttons**: `aria-label` describes what is being deleted.
- [ ] **ARIA — Notes editor**: `aria-label`, `aria-multiline` correct.
- [ ] **ARIA — All-complete prompt**: Announced via `aria-live="polite"`, buttons accessible.
- [ ] **ARIA — Landmarks**: `<main>`, `<nav>`, `<section>` with `aria-labelledby` on detail page.
- [ ] **Heading hierarchy**: `<h1>` title, `<h2>` sections, no skipped levels.
- [ ] **Color contrast**: All text 4.5:1, UI components 3:1, focus ring 3:1 (verify with axe).
- [ ] **Reduced motion**: All transitions disabled with `prefers-reduced-motion: reduce`.
- [ ] **Zoom 200%**: No horizontal scroll at 800px viewport, no content overlap.
- [ ] **Screen reader**: NVDA/VoiceOver announces all content logically, forms labeled, no duplicates.
- [ ] **Automated a11y tests**: Playwright + axe runs in CI, fails on violations.
- [ ] **Keyboard shortcuts documented**: Help modal or Settings section lists all shortcuts.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Scope**: This ticket covers Phase 3 components only. Phase 1/2 accessibility should have been addressed in their respective tickets; if gaps are found, file follow-up tickets.
- **Focus restoration on browser back**: The browser's back button doesn't fire a React lifecycle event. Use `window.addEventListener('pageshow', ...)` or a router-specific `onBeforeUnload`/`onPopState` to restore focus. Alternatively, accept that browser back may not restore focus perfectly (browser default is often sufficient).
- **Focus trap library**: `focus-trap-react` is lightweight and well-maintained. Add as dependency if not present.
- **Axe configuration**: Configure axe to ignore known false positives (e.g., color contrast on disabled elements if intentional). Document ignore rules in test file.
- **Testing priority**:
  1. Automated axe (catches ~50% of issues)
  2. Keyboard-only navigation test (manual + Playwright)
  3. Screen reader spot-check (manual, per release)
- **Keyboard shortcuts reference**: Add to a "Help" menu or Settings page. Shortcuts to document:
  - Global: `?` (show shortcuts), `Esc` (close modal/clear input)
  - List: `↑/↓` (navigate rows), `Enter` (open detail), `Alt+↑/↓` (reorder priority, Phase 2)
  - Detail: `Tab` (navigate), `Space/Enter` (toggle sub-task), `Enter` (save sub-task/note), `Esc` (dismiss prompt/close modal)
- **Future**: High contrast mode, font size scaling, internationalization (RTL) — out of scope for Phase 3.

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Audit and fix accessibility for Phase 3: keyboard nav, focus management, ARIA, contrast, reduced motion, automated axe tests, shortcuts doc.
