# Ticket: phase1-15-error-boundary-toast

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Global error boundary; toast notifications for iCal fetch errors, DB errors, network issues.

---

## Requirements

### Functional

- [ ] **Error Boundary**: Class component wrapping `App` (or `Layout`) to catch render errors
  - Fallback UI: "Something went wrong" with "Reload" button
  - Logs error to console (and optionally to file in Phase 2)
  - Does not catch: event handlers, async code, SSR, itself
- [ ] **Toast System**:
  - `useToast()` hook returning `{ success, error, info, warning, dismiss }`
  - Toast container (portal) fixed top-right
  - Auto-dismiss after 5s (configurable)
  - Manual dismiss (× button)
  - Stack multiple toasts (max 3 visible, queue rest)
  - Types: success (green), error (red), info (blue), warning (amber)
- [ ] **Integration**:
  - iCal fetch/import errors → `toast.error(message)`
  - DB errors → `toast.error(message)`
  - Network errors → `toast.error(message)`
  - Mark complete success → `toast.success('Marked complete')`
  - Sync now success → `toast.success('Synced: X new, Y updated')`

### Non-Functional

- [ ] **Accessibility**:
  - `role="alert"` for error toasts, `role="status"` for others
  - `aria-live="polite"` for non-critical, `assertive` for errors
  - Keyboard dismissible (Escape)
- [ ] **Animation**: Slide-in from right, fade-out (CSS transitions)
- [ ] **No Dependencies**: Custom implementation (no `react-hot-toast`, `sonner`, etc.)

---

## Designs & Constraints

- **Location**:
  - `src/frontend/src/components/ErrorBoundary.tsx` — class component
  - `src/frontend/src/components/ToastContainer.tsx` — portal root
  - `src/frontend/src/components/Toast.tsx` — individual toast
  - `src/frontend/src/hooks/useToast.ts` — context hook
  - `src/frontend/src/context/ToastContext.tsx` — provider
- **Integration**: Wrap `App` (or `Layout`) in `<ErrorBoundary><ToastProvider>...</ToastProvider></ErrorBoundary>`

### ToastContext API

```typescript
interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => string; // returns toastId
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismiss: (toastId: string) => void;
}

interface ToastOptions {
  duration?: number; // ms, default 5000
  onDismiss?: () => void;
}
```

### Error Boundary Fallback

```tsx
// ErrorBoundary.tsx
state = { hasError: false, error: null };

static getDerivedStateFromError(error: Error) {
  return { hasError: true, error };
}

componentDidCatch(error: Error, info: ErrorInfo) {
  console.error('ErrorBoundary caught:', error, info);
}

render() {
  if (this.state.hasError) {
    return (
      <div className={styles.fallback} role="alert">
        <h2>Something went wrong</h2>
        <p>{this.state.error?.message}</p>
        <button onClick={() => window.location.reload()}>Reload App</button>
      </div>
    );
  }
  return this.props.children;
}
```

---

## Code Changes

### New Files

- `src/frontend/src/components/ErrorBoundary.tsx`
- `src/frontend/src/components/ToastContainer.tsx`
- `src/frontend/src/components/Toast.tsx`
- `src/frontend/src/context/ToastContext.tsx`
- `src/frontend/src/hooks/useToast.ts`
- `src/frontend/src/__tests__/ErrorBoundary.test.tsx`
- `src/frontend/src/__tests__/useToast.test.tsx`

### Modified Files

- `src/frontend/src/App.tsx` — wrap with ErrorBoundary + ToastProvider
- `src/frontend/src/hooks/useAssignments.ts` — use `toast.error` for fetch errors
- `src/frontend/src/hooks/useSyncStatus.ts` — use `toast.success/error` for sync
- `src/frontend/src/components/SettingsModal.tsx` — use toast for fetch/import feedback

---

## Acceptance Criteria

| #   | Criterion                                                  | Verification                           |
| --- | ---------------------------------------------------------- | -------------------------------------- |
| 1   | Error boundary catches render errors                       | Throw in component, verify fallback UI |
| 2   | Error boundary logs error to console                       | Check console output                   |
| 3   | Toast container renders in portal                          | Inspect DOM                            |
| 4   | `toast.success/error/info/warning` show correct styling    | Visual test each type                  |
| 5   | Auto-dismiss after 5s (default)                            | Wait/test timer                        |
| 6   | Manual dismiss works                                       | Click × button                         |
| 7   | Max 3 visible, queue rest                                  | Fire 5 toasts, verify stacking         |
| 8   | Accessible (role, aria-live, Escape)                       | axe-core + keyboard test               |
| 9   | Integrated in useAssignments, useSyncStatus, SettingsModal | Trigger errors, verify toasts          |
| 10  | All tests pass (`pnpm test`)                               | CI run                                 |

---

## Notes

- Error boundary only catches render-phase errors; async errors must be caught manually and passed to toast
- Toast system is a prerequisite for tickets 1.10, 1.11, 1.14 — implement early or provide minimal inline fallback
- Consider using `react-dom/createPortal` for toast container to escape layout constraints

---

## Release Summary

Add global error boundary and accessible toast notification system
