# Accessibility

CourseFlow targets **WCAG 2.1 Level AA**. This document describes the accessibility
standards the app follows, the focus-management patterns used across the UI, and the
complete keyboard shortcuts reference.

## Standards

- Semantic landmarks: a single `<main id="main-content">` wraps page content; headings follow a logical hierarchy (`h1` → `h2` → `h3`).
- All interactive controls have an accessible name (visible text or `aria-label`).
- Dialogs use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and a focus trap.
- Live regions (`aria-live`) announce dynamic changes (toasts, sync status, priority reordering).
- Motion respects `prefers-reduced-motion` (animations and transitions are disabled).
- A skip link is the first focusable element on every page and moves focus to `#main-content`.

## Focus management

- **Skip link** — first tab stop; `Enter` moves focus to `#main-content`.
- **Dialogs** (`ConfirmModal`, `DeleteConfirmModal`) — focus is trapped within the dialog, initial focus lands on the safest action (Cancel), `Escape` closes, and focus returns to the trigger on close. See `useFocusTrap` and `useFocusRestoration`.
- **Route navigation** — `AssignmentListPage` saves focus before navigating to the detail view; `AssignmentDetailPage` restores it on back navigation (`FocusRestorationContext`).
- **Sub-task add input** — auto-focuses on mount and returns focus to the "Add note" button after note save/cancel.

## Keyboard shortcuts

### Global

| Shortcut          | Action                                            |
| ----------------- | ------------------------------------------------- |
| `Tab`             | Move to the next focusable element                |
| `Shift` + `Tab`   | Move to the previous focusable element            |
| `Enter` / `Space` | Activate the focused control                      |
| `Escape`          | Close the active dialog / clear the focused input |

### Assignment list

| Shortcut                  | Action                                           |
| ------------------------- | ------------------------------------------------ |
| `Enter` / `Space`         | Open the focused assignment's detail view        |
| `Alt` + `↑` / `Alt` + `↓` | Move the focused assignment up/down one position |
| `Alt` + `Shift` + `↑`     | Move the focused assignment to the top           |
| `Alt` + `Shift` + `↓`     | Move the focused assignment to the bottom        |
| `Escape`                  | Clear the search input                           |

### Assignment detail — sub-tasks

| Shortcut          | Action                                          |
| ----------------- | ----------------------------------------------- |
| `Space`           | Toggle the focused sub-task's completion        |
| `Enter`           | Add the sub-task in the input (when focused)    |
| `Escape`          | Clear the sub-task input                        |
| `Enter` / `Space` | Activate the progress bar (scroll to sub-tasks) |

### Assignment detail — notes

| Shortcut                         | Action                           |
| -------------------------------- | -------------------------------- |
| `Ctrl` + `Enter` / `⌘` + `Enter` | Save the note                    |
| `Escape`                         | Cancel editing / adding a note   |
| `Tab`                            | Insert indentation in the editor |

## Automated testing

Accessibility is covered by:

- Component tests (`src/frontend/src/**/__tests__`) using Testing Library + `jest-dom`.
- Playwright + axe-core E2E scans (`src/frontend/src/__tests__/integration/accessibility.playwright.ts`).

```bash
# Accessibility E2E (launches the dev server automatically)
pnpm test:e2e -- accessibility.playwright.ts
```

> **Note:** the automated scans run the structural WCAG rules. Colour-contrast is
> tracked separately, as the current design palette has a pre-existing contrast
> backlog that predates the Phase 3 work.
