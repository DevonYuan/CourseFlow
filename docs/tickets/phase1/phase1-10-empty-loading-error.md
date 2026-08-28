# Ticket: phase1-10-empty-loading-error

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Show skeleton loaders while fetching; empty state with "Add iCal URL in Settings" CTA; error toast for fetch/parse failures.

---

## Requirements

### Functional

- [ ] **Loading State**: Skeleton loaders (shimmer effect) for assignment rows while `useAssignments` hook is fetching
  - Show 3-5 skeleton rows matching row height
  - Animate with CSS keyframes (shimmer)
- [ ] **Empty State**: When `assignments.length === 0` and not loading
  - Centered illustration/icon
  - Message: "No assignments yet"
  - Subtext: "Add your Canvas iCal URL in Settings to get started"
  - CTA Button: "Open Settings" → opens Settings modal (ticket 1.6)
- [ ] **Error State**: When fetch/import fails
  - Toast notification (via toast system, ticket 1.15) with error message
  - Inline error banner in AssignmentList (optional): "Failed to load assignments. Check Settings."
  - Retry button to re-fetch

### Non-Functional

- [ ] **Skeleton**: CSS-only animation, no JS dependencies
- [ ] **Empty State**: Friendly, actionable copy
- [ ] **Error Messages**: User-friendly (not raw error codes); map `NETWORK_ERROR` → "Network error. Check connection.", `PARSE_ERROR` → "Invalid calendar format.", etc.
- [ ] **Accessibility**: `aria-live` for toast, proper heading structure

---

## Designs & Constraints

- **Location**:
  - `src/frontend/src/components/AssignmentListSkeleton.tsx` — skeleton rows
  - `src/frontend/src/components/EmptyState.tsx` — empty state component
  - Integrated into `AssignmentList.tsx` (ticket 1.9)
- **Toast System**: Use `useToast` hook from ticket 1.15
- **Error Mapping** (in `useAssignments` hook or shared util):

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Network error. Check your internet connection.',
  HTTP_ERROR: 'Failed to fetch calendar. The URL may be incorrect.',
  TIMEOUT_ERROR: 'Request timed out. Try again.',
  PARSE_ERROR: 'Invalid calendar format. Check the iCal URL.',
  VALIDATION_ERROR: 'Invalid URL. Must be a valid http/https URL.',
  DEFAULT: 'An unexpected error occurred. Please try again.',
};
```

---

## Code Changes

### New Files

- `src/frontend/src/components/AssignmentListSkeleton.tsx`
- `src/frontend/src/components/EmptyState.tsx`
- `src/frontend/src/utils/errorMessages.ts` — error code mapping

### Modified Files

- `src/frontend/src/components/AssignmentList.tsx` — integrate skeleton/empty/error states
- `src/frontend/src/hooks/useAssignments.ts` — expose error state

---

## Acceptance Criteria

| #   | Criterion                             | Verification                     |
| --- | ------------------------------------- | -------------------------------- |
| 1   | Skeleton shows while loading          | Visual test: delay mock response |
| 2   | Empty state shows when no assignments | Test with empty DB               |
| 3   | Empty state CTA opens Settings modal  | Click test                       |
| 4   | Error toast shows on fetch failure    | Test with mock IPC rejection     |
| 5   | Error messages are user-friendly      | Test each error code mapping     |
| 6   | Retry button re-triggers fetch        | Click test                       |
| 7   | All tests pass (`pnpm test`)          | CI run                           |

---

## Notes

- Skeleton should match the visual structure of `AssignmentRow` (same height, layout)
- Empty state only shows when user has never synced OR after sync with zero results
- Error toast auto-dismisses after 5s; user can dismiss manually
- This ticket depends on toast system (1.15) — can implement inline error banner first, swap to toast when ready

---

## Release Summary

Add skeleton loaders, empty state with Settings CTA, and error toasts for AssignmentList
