# Phase 1 — MVP (Tracking Assignments)

> **Goal:** Deliver a functional homework tracker with the minimum viable feature set — fetch/parse Canvas iCal, store assignments in SQLite, render a chronological list, and mark assignments as "done."
>
> **Exit Criteria:** A user can enter their Canvas iCal URL, fetch assignments, see them in a chronological list, and mark them complete — all persisting locally in SQLite.

---

## Overview

Phase 1 builds on the Phase 0 foundation (scaffold, database, IPC, typed bridge) to implement the core Canvas integration and assignment tracking loop:

1. **Configure** → User enters their Canvas iCal URL in settings
2. **Fetch** → App pulls the iCal feed from Canvas Calendar
3. **Parse** → iCal events are converted to `Assignment` entities
4. **Store** → Assignments saved to SQLite (deduplicated by iCal UID)
5. **Display** → Chronological list rendered in React frontend
6. **Act** → User marks assignments done; state persists instantly

---

## Phase 1 Scope — What Needs to Be Done

### A. iCal Integration (Backend)

| #   | Task                          | Details                                                                                                                                                                                                                                        |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **iCal fetch utility**        | Add `fetchICalFeed(url: string): Promise<string>` in `src/backend/main/ical/` using native `fetch` with timeout, retry (exponential backoff, max 3), and proper error handling (network, 4xx, 5xx).                                            |
| 1.2 | **iCal parser**               | Add `parseICalFeed(text: string): ICalEvent[]` using `ical.js` (npm) or lightweight custom parser. Must handle: `VEVENT` → `ICalEvent`, extract `UID`, `SUMMARY`, `DESCRIPTION`, `DTSTART`, `DTEND`, `RRULE`, `URL`, `CATEGORIES`, `LOCATION`. |
| 1.3 | **iCal → Assignment mapping** | Transform `ICalEvent[]` → `AssignmentInput[]`: derive `courseId` from `CATEGORIES` or `SUMMARY`, `dueDate` from `DTSTART`, `source='ical'`, `sourceUrl` from `UID`/`URL`, `status='pending'`, `priority` from due date (sooner = higher).      |
| 1.4 | **Deduplication logic**       | On import, match by `ical_uid` (stored on Assignment). Update existing if `updated_at` newer; insert new. Return `{ imported: number; skipped: number; updated: number }`.                                                                     |
| 1.5 | **IPC handlers for iCal**     | Implement `ical:fetch` and `ical:import` in `ipc-handlers.ts` using the above. Emit `ical:progress` events (`fetch` → `parse` → `store`) for UI feedback.                                                                                      |

### B. Settings & iCal URL Management (Backend + Frontend)

| #   | Task                     | Details                                                                                                                                                                                  |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.6 | **Settings UI**          | Build a Settings page/modal in React: input for iCal URL, "Fetch Now" button, auto-fetch interval dropdown, theme selector.                                                              |
| 1.7 | **iCal URL encryption**  | Implement AES-GCM encryption for the iCal URL in the `settings` table per `docs/architecture/security.md`. Use Web Crypto API in Main process; store `{ ciphertext, iv, salt }` as JSON. |
| 1.8 | **Settings persistence** | Wire `settings:get` / `settings:set` / `settings:reset` IPC to the Settings UI. Load settings on app start; apply theme immediately.                                                     |

### C. Assignment List UI (Frontend)

| #    | Task                               | Details                                                                                                                                                                        |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.9  | **Assignment list component**      | Build `AssignmentList` component: fetch via `window.api.db.assignments.list()`, render chronologically (by `dueDate`), show course color badge, title, due date, status badge. |
| 1.10 | **Empty / loading / error states** | Show skeleton loaders while fetching; empty state with "Add iCal URL in Settings" CTA; error toast for fetch/parse failures.                                                   |
| 1.11 | **Mark complete interaction**      | Click checkbox/btn → `window.api.db.assignments.upsert({ ...status: 'completed' })` → optimistic UI update → toast confirmation.                                               |
| 1.12 | **Auto-refresh on DB changes**     | Subscribe to `window.api.onDbChanged` → re-fetch list when `assignments` table changes.                                                                                        |

### D. App Shell & Navigation (Frontend)

| #    | Task                              | Details                                                                                                 |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1.13 | **Layout / navigation**           | Top bar with app title, sync status indicator, settings gear icon. Responsive layout (min-width 800px). |
| 1.14 | **Sync status indicator**         | Show last sync time, next auto-sync countdown, manual "Sync Now" button with spinner.                   |
| 1.15 | **Error boundary + toast system** | Global error boundary; toast notifications for iCal fetch errors, DB errors, network issues.            |

---

## Non-Coding Actions (Outside Writing Feature Code)

> These are often blockers or prerequisites for the coding work above.

### Environment & Dependencies

- [ ] **Add `ical.js` dependency** — `pnpm add ical.js @types/ical.js` (or evaluate lighter alternatives like `node-ical`).
- [ ] **Verify Web Crypto availability** — Node 24 has full Web Crypto; confirm `crypto.subtle` works in Electron Main context.
- [ ] **Test iCal feed samples** — Obtain real Canvas iCal URLs (or mock `.ics` files) to validate parsing against real data (recurring events, all-day events, HTML descriptions, timezone handling).

### Architecture & Design Decisions (Resolve Before Coding)

- [ ] **Timezone handling** — Canvas iCal feeds use UTC (`DTSTART:20251015T235900Z`). Decide: store as UTC ISO strings; display in user's local timezone in UI. Document in `docs/architecture/data-model.md`.
- [ ] **Recurring events (RRULE)** — Canvas uses recurring events for repeating assignments. Decide MVP approach: (a) expand RRULE into individual occurrences on import (complex), (b) store RRULE on Assignment and expand in UI only (simpler), (c) ignore RRULE for MVP, only import non-recurring. **Recommendation:** (b) for MVP — store RRULE, expand in UI later.
- [ ] **Course extraction heuristic** — Canvas iCal `CATEGORIES` often contains course codes (e.g., `CS101`). Fallback: parse from `SUMMARY` prefix (e.g., `[CS101] Homework 1`). Define and document the heuristic.
- [ ] **Auto-fetch scheduling** — Use `setInterval` in Main process? Or `electron-util`'s `schedule`? Decide and implement in Phase 1.6 (Settings) or defer to Phase 2.
- [ ] **Conflict resolution on re-import** — If user edits an assignment locally (e.g., adds notes) then re-syncs, how to merge? **MVP:** Never overwrite local `description`, `notes`, `subtasks`, `priority` on re-import — only update `dueDate`, `title`, `workflow_state` from Canvas.

### Product / Data

- [ ] **Validate data model against real iCal** — Confirm `Assignment` fields in `src/backend/shared/types.ts` capture all needed iCal data. Add missing fields if necessary (e.g., `rrule`, `location`).
- [ ] **Define "done" semantics** — `status: 'completed'` vs `archived`. MVP: `completed` hides from default list but keeps in DB; "Show Completed" toggle in UI.

### Process & Hygiene

- [ ] **Create Phase 1 tickets** — Break down the coding tasks above into individual ticket files under `docs/tickets/phase1/` using the template (`docs/tickets/template-for-tickets.md`).
- [ ] **Update root README** — Add "Current Phase: 1 (MVP)" badge and link to this doc.
- [ ] **Add Vitest tests** — Unit tests for iCal parser, mapper, deduplication logic; integration test for `ical:import` IPC handler.

---

## Deliverables Checklist

By the end of Phase 1:

### Backend (Main Process)

- [ ] `src/backend/main/ical/fetch.ts` — robust fetch with retry/timeout
- [ ] `src/backend/main/ical/parse.ts` — iCal → `ICalEvent[]`
- [ ] `src/backend/main/ical/map.ts` — `ICalEvent[]` → `AssignmentInput[]`
- [ ] `src/backend/main/ical/import.ts` — deduplication + DB upsert
- [ ] IPC handlers for `ical:fetch`, `ical:import` + progress events
- [ ] Settings encryption (AES-GCM) for `ical_url`

### Frontend (Renderer)

- [ ] Settings page/modal with iCal URL input, fetch button, theme, auto-sync interval
- [ ] Assignment list view (chronological, course color, due date, status)
- [ ] Mark complete interaction (optimistic + toast)
- [ ] Sync status indicator (last sync, next sync, manual sync button)
- [ ] Global toast/error boundary system
- [ ] Responsive layout with navigation

### Integration

- [ ] End-to-end flow: Settings → enter iCal URL → Fetch → list renders → mark done → persists
- [ ] Auto-fetch on startup if `autoFetchIcal` enabled
- [ ] `db:changed` event propagation works for real-time UI updates

### Documentation

- [ ] Phase 1 tickets created in `docs/tickets/phase1/`
- [ ] `docs/architecture/data-model.md` updated with timezone/RRULE decisions
- [ ] Root README updated with current phase

---

## Suggested Ticket Breakdown

| Ticket ID                       | Title                                                       | Area       |
| ------------------------------- | ----------------------------------------------------------- | ---------- |
| `phase1-01-ical-fetch`          | iCal Feed Fetch Utility                                     | Backend    |
| `phase1-02-ical-parse`          | iCal Parser (VEVENT → ICalEvent)                            | Backend    |
| `phase1-03-ical-map`            | iCal → Assignment Mapping & Deduplication                   | Backend    |
| `phase1-04-ical-ipc`            | IPC Handlers: `ical:fetch`, `ical:import` + Progress Events | Backend    |
| `phase1-05-settings-encryption` | Settings Encryption (AES-GCM for iCal URL)                  | Backend    |
| `phase1-06-settings-ui`         | Settings Page/Modal (iCal URL, Theme, Auto-sync)            | Frontend   |
| `phase1-07-assignment-list`     | Assignment List Component (Chronological)                   | Frontend   |
| `phase1-08-mark-complete`       | Mark Assignment Complete Interaction                        | Frontend   |
| `phase1-09-shell-nav`           | App Shell: Layout, Navigation, Sync Status                  | Frontend   |
| `phase1-10-toast-errors`        | Toast System + Error Boundary                               | Frontend   |
| `phase1-11-integration`         | End-to-End Integration & Auto-fetch on Startup              | Full Stack |
| `phase1-12-tests`               | Unit/Integration Tests for iCal Pipeline                    | Test       |

---

## Dependencies Between Tickets

```mermaid
flowchart TD
    A[phase1-01-ical-fetch] --> C[phase1-03-ical-map]
    B[phase1-02-ical-parse] --> C
    C --> D[phase1-04-ical-ipc]
    E[phase1-05-settings-encryption] --> F[phase1-06-settings-ui]
    D --> G[phase1-07-assignment-list]
    G --> H[phase1-08-mark-complete]
    F --> I[phase1-09-shell-nav]
    I --> J[phase1-10-toast-errors]
    D & F & H & J --> K[phase1-11-integration]
    K --> L[phase1-12-tests]
```

---

## Estimated Effort

| Category                                               | Estimate      |
| ------------------------------------------------------ | ------------- |
| Backend iCal pipeline (fetch, parse, map, import, IPC) | 2–3 days      |
| Settings encryption + UI                               | 1 day         |
| Frontend assignment list + interactions                | 2 days        |
| App shell, navigation, toasts, error handling          | 1 day         |
| Integration, testing, polish                           | 1–2 days      |
| **Total**                                              | **~7–9 days** |

---

## Risks & Mitigations

| Risk                                                        | Likelihood | Impact | Mitigation                                                                                    |
| ----------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------- |
| iCal parsing edge cases (timezones, RRULE, malformed feeds) | High       | High   | Start with real Canvas `.ics` samples; use battle-tested `ical.js`; write parser tests first. |
| Web Crypto subtle API differences in Electron Main          | Low        | Medium | Test encryption/decryption round-trip early; fallback to `node:crypto` if needed.             |
| sql.js WASM performance with large assignment lists         | Low        | Low    | MVP expects <500 assignments; `sql.js` handles this easily. Monitor.                          |
| Canvas iCal URL changes / auth expiry                       | Medium     | Medium | Store URL encrypted; show clear error toast on 401/403; allow re-entry in Settings.           |
| Recurring event expansion complexity                        | Medium     | High   | Defer full RRULE expansion to Phase 2; store RRULE string for now.                            |

---

## Next Phase Preview (Phase 2)

- Drag-and-drop priority reordering (persist to `priority_order` table)
- Filtering (by course, due date, status) and sorting
- Grouping views ("This Week", "Overdue", "Completed")
- Keyboard shortcuts for power users

---

## References

- `docs/roadmap.md` — High-level roadmap
- `docs/architecture/data-model.md` — Entity definitions
- `docs/architecture/ipc-contract.md` — IPC channel specifications
- `docs/architecture/process-model.md` — Electron process architecture
- `docs/architecture/security.md` — iCal URL encryption design
- `src/backend/shared/types.ts` — Domain types (Assignment, ICalEvent, Settings, etc.)
- `src/backend/shared/ipc.ts` — Typed IPC contracts
- `src/backend/main/db/` — Database connection, migration, repository
- `src/backend/main/ipc-handlers.ts` — IPC handler implementations
- `src/backend/preload/index.ts` — Typed contextBridge API
