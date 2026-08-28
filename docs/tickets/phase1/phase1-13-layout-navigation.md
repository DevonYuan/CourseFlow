# Ticket: phase1-13-layout-navigation

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Top bar with app title, sync status indicator, settings gear icon. Responsive layout (min-width 800px).

---

## Requirements

### Functional

- [ ] **Top Bar** (fixed header, ~56px height):
  - App title: "CourseFlow" (link to home/assignment list)
  - Sync status indicator (ticket 1.14) — shows last sync, next auto-sync, manual sync button
  - Settings gear icon (right side) → opens Settings modal (ticket 1.6)
  - "Show Completed" toggle (checkbox) — filters assignment list
- [ ] **Main Content Area**: `AssignmentList` component (ticket 1.9)
- [ ] **Responsive**:
  - Min-width 800px (horizontal scroll if narrower)
  - Top bar collapses gracefully on narrow (icon-only mode optional for Phase 2)
- [ ] **Keyboard**: Focus trap in Settings modal, Escape closes modal

### Non-Functional

- [ ] **Styling**: CSS Modules or Tailwind (project choice) — consistent spacing, colors
- [ ] **Theme Support**: Respects `theme` setting (light/dark/system) via CSS variables
- [ ] **Accessibility**: Semantic `<header>`, `<main>`, proper heading hierarchy, ARIA labels

---

## Designs & Constraints

- **Location**:
  - `src/frontend/src/components/TopBar.tsx` — header component
  - `src/frontend/src/components/Layout.tsx` — wrapper with header + main
  - `src/frontend/src/App.tsx` — compose Layout
- **State**:
  - `showCompleted` in Zustand store (assignments store or UI store)
  - Sync status from `useSyncStatus` hook (ticket 1.14)

### Layout Structure

```tsx
// Layout.tsx
<header className={styles.topBar}>
  <TopBar />
</header>
<main className={styles.mainContent} role="main">
  {children}  {/* AssignmentList */}
</main>
```

### TopBar Structure

```tsx
// TopBar.tsx
<nav className={styles.nav} aria-label="Main navigation">
  <h1 className={styles.title}>
    <Link to="/">CourseFlow</Link>
  </h1>
  <div className={styles.center}>
    <SyncStatusIndicator /> {/* Ticket 1.14 */}
  </div>
  <div className={styles.actions}>
    <label className={styles.toggle}>
      <input type="checkbox" checked={showCompleted} onChange={toggleShowCompleted} />
      <span>Show Completed</span>
    </label>
    <button className={styles.settingsBtn} aria-label="Settings" onClick={openSettings}>
      <SettingsIcon />
    </button>
  </div>
</nav>
```

---

## Code Changes

### New Files

- `src/frontend/src/components/TopBar.tsx`
- `src/frontend/src/components/Layout.tsx`
- `src/frontend/src/components/TopBar.module.css` (or Tailwind classes)
- `src/frontend/src/__tests__/Layout.test.tsx`

### Modified Files

- `src/frontend/src/App.tsx` — use Layout, integrate TopBar
- `src/frontend/src/store/uiStore.ts` — `showCompleted` state (or add to assignmentsStore)

---

## Acceptance Criteria

| #   | Criterion                                                | Verification                    |
| --- | -------------------------------------------------------- | ------------------------------- |
| 1   | Top bar renders with title, sync status, settings button | Visual test                     |
| 2   | Settings button opens Settings modal                     | Click test                      |
| 3   | "Show Completed" toggle filters list                     | Test with completed assignments |
| 4   | Responsive at min-width 800px                            | Resize test                     |
| 5   | Theme (light/dark) applied correctly                     | Toggle theme, verify colors     |
| 6   | Accessible (semantic HTML, ARIA)                         | axe-core test                   |
| 7   | All tests pass (`pnpm test`)                             | CI run                          |

---

## Notes

- Sync status indicator is a separate component (ticket 1.14) — integrate here
- "Show Completed" toggle state persists in settings (`showCompleted` field, ticket 1.8)
- This is the app shell — all other components render within Layout

---

## Release Summary

Add app shell: top bar with title, sync status, settings, and Show Completed toggle
