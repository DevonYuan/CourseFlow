# Ticket: phase1-01-ical-fetch

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Add a robust `fetchICalFeed(url: string): Promise<string>` utility in `src/backend/main/ical/` that fetches the Canvas iCal feed using native `fetch` with timeout, retry (exponential backoff, max 3), and proper error handling for network errors, 4xx, and 5xx responses.

---

## Requirements

### Functional

- [ ] `fetchICalFeed(url: string)` accepts a Canvas iCal URL and returns the raw iCal text
- [ ] Configurable timeout (default: 15 seconds) with `AbortController`
- [ ] Exponential backoff retry: 1s → 2s → 4s (max 3 attempts total)
- [ ] Proper error types: `NetworkError`, `HttpError` (with status code), `TimeoutError`
- [ ] Validates response is text/calendar content-type (warn but don't fail)
- [ ] Handles redirects (max 5)
- [ ] User-Agent header identifying CourseFlow app version

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Pure TypeScript — no Electron/Node-specific globals (uses global `fetch`)
- [ ] Unit testable (no side effects in pure functions, dependency injection for fetch if needed)
- [ ] Comprehensive error messages for debugging (include URL, status, attempt number)

---

## Designs & Constraints

- **Location**: `src/backend/main/ical/fetch.ts`
- **Export**: Single `fetchICalFeed` function + error classes
- **Dependencies**: None beyond standard library (Node 24 has global `fetch`)
- **Configuration**: Timeout and max retries via optional parameters with sensible defaults
- **Security**: No credentials in URL logged; sanitize URLs in error messages (strip query params if they contain tokens)

### Error Classes

```typescript
export class ICalFetchError extends Error {
  constructor(message: string, public readonly cause?: Error) { super(message); }
}

export class NetworkError extends ICalFetchError { /* ... */ }
export class HttpError extends ICalFetchError { constructor(message: string, public readonly status: number) { ... } }
export class TimeoutError extends ICalFetchError { /* ... */ }
```

---

## Code Changes

### New Files

- `src/backend/main/ical/fetch.ts` — fetch utility with retry/timeout
- `src/backend/main/ical/index.ts` — barrel export for ical module
- `src/backend/main/ical/__tests__/fetch.test.ts` — unit tests

### Modified Files

- `src/backend/shared/types.ts` — add `ICalEvent` type if not present (shared with parser)

---

## Acceptance Criteria

| #   | Criterion                                                   | Verification                |
| --- | ----------------------------------------------------------- | --------------------------- |
| 1   | `fetchICalFeed` returns iCal text for valid URL             | Unit test with mock server  |
| 2   | Throws `TimeoutError` after 15s (configurable)              | Unit test with slow mock    |
| 3   | Retries 3 times with exponential backoff on network failure | Unit test with failing mock |
| 4   | Throws `HttpError` with status for 4xx/5xx                  | Unit test with mock 404/500 |
| 5   | Strips sensitive query params from logged URLs              | Code review + test          |
| 6   | All tests pass (`pnpm test`)                                | CI run                      |

---

## Notes

- Canvas iCal feeds are public URLs (no auth in URL), but some institutions may embed tokens — always sanitize
- Consider adding a `fetchICalFeedWithProgress` variant later for large feeds (Phase 2)
- This utility will be called by `ical:fetch` IPC handler (ticket 1.5)

---

## Release Summary

Add robust iCal feed fetcher with timeout, retry, and typed errors
