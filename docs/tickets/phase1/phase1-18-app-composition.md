# Ticket: phase1-18-app-composition

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Compose the root `App.tsx` with all Phase 1 shell components: `ErrorBoundary`, `ToastProvider`, `Layout` (with `TopBar`), and routing structure.

---

## PREREQUISITE

**This ticket depends on:**

- Ticket 1.0 (Data Model Alignment) — for types
- Ticket 1.13 (Layout/Navigation) — `Layout` and `TopBar` components
- Ticket 1.14 (Sync Status) — `SyncStatusIndicator` (used in TopBar)
- Ticket 1.15 (Error Boundary + Toast) — `ErrorBoundary`, `ToastProvider`, `useToast`

---

## Requirements

### Functional

- [ ] **App Structure**:

  ```tsx
  // App.tsx
  <ErrorBoundary>
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<AssignmentListPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </ToastProvider>
  </ErrorBoundary>
  ```

- [ ] **Pages**:
  - `AssignmentListPage` — wraps `AssignmentList` (Ticket 1.9) with page layout
  - `SettingsPage` — wraps `SettingsModal` (Ticket 1.6) as full page or modal trigger

- [ ] **Settings Modal Integration**: `SettingsModal` accessible from TopBar settings button (Ticket 1.13)

- [ ] **Theme Application**: Apply `theme` from settings to document root (CSS variables)

---

## Designs & Constraints

- **Location**: `src/frontend/src/App.tsx`
- **Routing**: Use `react-router-dom` (v6+) — already in deps from Phase 0
- **Theme**: Read from `useSettings()` hook (Ticket 1.8), apply to `<html data-theme="...">`

### App.tsx Structure

```tsx
// src/frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { AssignmentListPage } from './pages/AssignmentListPage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettings } from './hooks/useSettings';
import { useEffect } from 'react';

function ThemedApp() {
  const { settings } = useSettings();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Layout>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AssignmentListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </BrowserRouter>
        </Layout>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default ThemedApp;
```

---

## Code Changes

### Modified Files

- `src/frontend/src/App.tsx` — compose all shell components
- `src/frontend/src/main.tsx` — ensure renders `App`

### New Files

- `src/frontend/src/pages/AssignmentListPage.tsx` — page wrapper for AssignmentList
- `src/frontend/src/pages/SettingsPage.tsx` — page wrapper for SettingsModal

---

## Acceptance Criteria

| #   | Criterion                                  | Verification                        |
| --- | ------------------------------------------ | ----------------------------------- |
| 1   | App renders without errors                 | Visual test                         |
| 2   | ErrorBoundary catches render errors        | Throw in component, verify fallback |
| 3   | ToastProvider works — toasts appear        | Trigger toast from any component    |
| 4   | Layout renders with TopBar                 | Visual test                         |
| 5   | Routing works — "/" shows assignments      | Navigate test                       |
| 6   | Routing works — "/settings" shows settings | Navigate test                       |
| 7   | Theme applies to document root             | Inspect `<html data-theme="...">`   |
| 8   | Settings button in TopBar opens Settings   | Click test                          |
| 9   | All tests pass (`pnpm test`)               | CI run                              |

---

## Notes

- This ticket **integrates** components from Tickets 1.6, 1.9, 1.13, 1.14, 1.15
- Can be done in parallel with those tickets once their component APIs are defined
- `AssignmentListPage` and `SettingsPage` are thin wrappers — main logic in components

---

## Release Summary

Compose root App with ErrorBoundary, ToastProvider, Layout, routing, and theme
