# Ticket: phase1-02-ical-parse

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 1 day

---

## Description

Add an `parseICalFeed(text: string): ICalEvent[]` function in `src/backend/main/ical/` that parses raw iCal text into structured `ICalEvent` objects. Use `ical.js` (npm) for robust parsing. Must handle: `VEVENT` → `ICalEvent`, extracting `UID`, `SUMMARY`, `DESCRIPTION`, `DTSTART`, `DTEND`, `RRULE`, `URL`, `CATEGORIES`, `LOCATION`.

---

## Requirements

### Functional

- [ ] `parseICalFeed(text: string)` returns `ICalEvent[]` (one per `VEVENT`)
- [ ] Extract all required fields from each `VEVENT`:
  - `uid` (string, required) — `UID` property
  - `summary` (string) — `SUMMARY` property
  - `description` (string, optional) — `DESCRIPTION` property (may contain HTML)
  - `dtStart` (string, required) — `DTSTART` property as ISO 8601 UTC string
  - `dtEnd` (string, optional) — `DTEND` property as ISO 8601 UTC string
  - `rrule` (string, optional) — `RRULE` property as raw string
  - `url` (string, optional) — `URL` property
  - `categories` (string[]) — `CATEGORIES` property (comma-separated list)
  - `location` (string, optional) — `LOCATION` property
- [ ] Handle `VTIMEZONE` components for proper timezone conversion → output UTC ISO strings
- [ ] Skip non-`VEVENT` components (`VTODO`, `VJOURNAL`, etc.) with debug log
- [ ] Throw descriptive `ICalParseError` on malformed iCal

### Non-Functional

- [ ] Dependency: `ical.js` (`pnpm add ical.js @types/ical.js`)
- [ ] Zero `any` — `ICalEvent` type already defined in `src/backend/shared/types.ts`
- [ ] Pure function — no I/O, no side effects
- [ ] Handle large feeds efficiently (streaming parse if needed, but `ical.js` loads full text)
- [ ] Unit tests with real Canvas iCal samples

---

## Designs & Constraints

- **Location**: `src/backend/main/ical/parse.ts`
- **Export**: `parseICalFeed`, `ICalParseError`, `ICalEvent` (re-exported from shared types)
- **Library**: `ical.js` — battle-tested, handles RFC 5545 edge cases (folded lines, escaped chars, timezones)
- **Alternative evaluated**: `node-ical` — lighter but less maintained; `ical.js` preferred for correctness

### `ICalEvent` Type (already in `src/backend/shared/types.ts`)

```typescript
export interface ICalEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  dtStart: string; // ISO 8601 UTC
  dtEnd: string | null; // ISO 8601 UTC
  rrule: string | null;
  url: string | null;
  categories: string[];
}
```

### Timezone Handling

- `ical.js` returns `Date` objects in local timezone or UTC depending on input
- **Decision**: Parser must normalize all dates to **UTC ISO 8601 strings** (`dtStart`, `dtEnd`)
- Document in `docs/architecture/data-model.md`

---

## Code Changes

### New Files

- `src/backend/main/ical/parse.ts` — parser implementation
- `src/backend/main/ical/__tests__/parse.test.ts` — unit tests with fixture `.ics` files

### Modified Files

- `package.json` — add `ical.js` and `@types/ical.js` dependencies

---

## Acceptance Criteria

| #   | Criterion                                     | Verification                          |
| --- | --------------------------------------------- | ------------------------------------- |
| 1   | Parses sample Canvas iCal feed without errors | Unit test with real `.ics` fixture    |
| 2   | Extracts all required fields correctly        | Unit test assertions on each field    |
| 3   | Handles `RRULE` (recurring events)            | Test with `RRULE:FREQ=WEEKLY` fixture |
| 4   | Handles `VTIMEZONE` for non-UTC events        | Test with `America/New_York` fixture  |
| 5   | Throws `ICalParseError` on invalid iCal       | Unit test with malformed input        |
| 6   | Skips non-VEVENT components gracefully        | Test with `VTODO` in feed             |
| 7   | All dates output as UTC ISO 8601 strings      | Test assertions on `dtStart`/`dtEnd`  |
| 8   | All tests pass (`pnpm test`)                  | CI run                                |

---

## Notes

- Obtain real Canvas iCal samples (or create realistic fixtures) for testing
- Canvas iCal typically uses UTC (`DTSTART:20251015T235900Z`) but may include `VTIMEZONE`
- `DESCRIPTION` often contains HTML — store as-is, sanitize in UI
- `CATEGORIES` in Canvas often contains course code (e.g., `CS101`) — used for course extraction in mapper (ticket 1.3)

---

## Release Summary

Add iCal parser using ical.js to extract VEVENTs into typed ICalEvent objects
