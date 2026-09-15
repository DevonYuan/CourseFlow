# Phase 4 — Polish & Multi-Calendar (In Progress)

> **Goal:** Deliver a production-ready desktop app with multi-calendar support, polish features (Pomodoro timer, notes graph visualization), and cross-platform packaging.
>
> **Exit Criteria:**
> - Users can manage **N iCal feeds** (Google Calendar, Canvas, Outlook, Birthdays, family calendars, etc.) with per-feed sync state, color badges, and a unified assignment list
> - **Pomodoro timer** integrated into the UI with configurable work/break intervals
> - **Notes graph visualization** showing the page hierarchy as an interactive node tree
> - Cross-platform installers (Windows NSIS, macOS DMG, Linux AppImage) with auto-updater support
> - All Phase 3 features remain functional and tested

---

## Overview

Phase 3 delivered a fully functional productivity tool: assignment tracking with priority ordering, sub-tasks, notes, and a Notion-style standalone Notes workspace with hierarchical pages, markdown editing, and search.

Phase 4 expands the app in three dimensions:

| Dimension | Feature | Description |
|-----------|---------|-------------|
| **Data** | Multi-Calendar (Multi-Feed) | Replace single `icalUrl` with first-class `CalendarSource` entities — multiple encrypted feeds, per-source sync, unified list with attribution |
| **Productivity** | Pomodoro Timer | Built-in focus timer (work/break cycles) accessible from the TopBar or a dedicated view |
| **Productivity** | Notes Graph Visualization | Interactive node-tree rendering of the `pages` hierarchy (force-directed or radial layout) |
| **Delivery** | Packaging & Distribution | `electron-builder` NSIS/DMG/AppImage, auto-updater, code signing prep, notarization prep |

---

## Phase 4 Scope — What Needs to Be Done

### ⚠️ BLOCKING PREREQUISITE (Do First)

| # | Ticket ID | Title | Description |
|---|-----------|-------|-------------|
| 4.0 | `phase4-00-data-model-update` | **Data Model & IPC Alignment for Multi-Calendar** | Extend shared types, IPC contracts, database schema, and repository mappers for `CalendarSource` entity. Add `source_id` FK to `assignments`. Run migration v6. **All other tickets depend on this.** |

---

### A. Multi-Calendar / Multi-Feed (Core Data Feature)

| # | Ticket ID | Title | Details |
|---|-----------|-------|---------|
| 4.1 | `phase4-01-calendars-schema` | CalendarSource Schema & Repo | Add `calendars` table: `id`, `name`, `feed_url` (encrypted), `enabled`, `color`, `position`, `last_sync_at`, `next_sync_at`, `last_error`, `created_at`, `updated_at`. Extend repository with CRUD + reorder. |
| 4.2 | `phase4-02-calendars-ipc` | IPC Handlers for Calendars | Implement `db:calendars:list`, `get`, `create`, `update`, `delete`, `reorder`, `setEnabled` in `ipc-handlers.ts`. Emit `db:changed` for `calendars` table. |
| 4.3 | `phase4-03-calendars-preload` | Preload Bridge for Calendars | Extend `src/backend/preload/index.ts` with `window.api.db.calendars.*` typed API. |
| 4.4 | `phase4-04-migration-v6` | Database Migration v6 | Create migration: `calendars` table + `assignments.source_id` FK (nullable). Seed one `calendars` row from existing `settings.icalUrl` (decrypt → re-encrypt into `calendars.feed_url`). Backfill `assignments.source_id` by matching `source_url`. Add index on `assignments(source_id, ical_uid)`. |
| 4.5 | `phase4-05-import-per-source` | Per-Source Import & Dedupe | Refactor `importAssignments` to accept `sourceId` and scope dedupe/prune to that source only. Update `ical:import` IPC to take `sourceId`. Scheduler iterates enabled sources sequentially. |
| 4.6 | `phase4-06-scheduler-multi` | Multi-Source Scheduler | Update `src/backend/main/scheduler.ts` to loop over enabled `CalendarSource`s. Per-source retry/backoff (max 3). Per-source `last_sync_at`, `next_sync_at`, `last_error`. Emit `ical:progress` with `sourceId` in payload. Coalesce manual "Sync Now" per-source. |
| 4.7 | `phase4-07-calendars-settings-ui` | Calendars Management UI | Settings page: list calendars (name, color badge, enabled toggle, last sync, error), "Add Calendar" modal (name, iCal URL, color picker), drag-reorder, delete with confirmation. Persist to `calendars` table via new IPC. |
| 4.8 | `phase4-08-unified-list-ui` | Unified Assignment List with Attribution | Update `AssignmentList` to show color badge per assignment (from `CalendarSource.color`). Add source filter to FilterBar (multi-select calendar chips). Grouping "By Calendar" option. TopBar shows per-source sync status (spinner, last sync time, error). |
| 4.9 | `phase4-09-encryption-multi` | Multi-Feed Encryption | Reuse existing AES-GCM encryption (`security.md`). Each `CalendarSource.feed_url` encrypted independently with its own salt/IV. `settings.icalUrl` deprecated (kept for backward compat, read-only). |

---

### B. Pomodoro Timer (Productivity Feature)

| # | Ticket ID | Title | Details |
|---|-----------|-------|---------|
| 4.10 | `phase4-10-pomodoro-types` | Pomodoro Types & State | Define `PomodoroState`: `idle` \| `running` \| `paused` \| `break`. `PomodoroConfig`: `workMinutes` (default 25), `shortBreakMinutes` (5), `longBreakMinutes` (15), `sessionsUntilLongBreak` (4). Add to `Settings` or dedicated `pomodoro` key. |
| 4.11 | `phase4-11-pomodoro-store` | Pomodoro Zustand Store | Timer logic: countdown, phase transitions, session count, audio/visual notifications. Persist config to settings. Expose `start`, `pause`, `reset`, `skip` actions. |
| 4.12 | `phase4-12-pomodoro-ui` | Pomodoro UI Component | TopBar timer display (mm:ss) with phase indicator (work/break). Click to expand: start/pause/reset/skip, config button. Optional: dedicated `/pomodoro` route with larger timer, session history. |
| 4.13 | `phase4-13-pomodoro-notifications` | Notifications & Sounds | Desktop notification (Electron `Notification` API) on phase complete. Optional sound (bundled `.wav`). Respect `doNotDisturb` / focus assist. Settings: enable/disable notifications, sound, auto-start breaks. |

---

### C. Notes Graph Visualization (Productivity Feature)

| # | Ticket ID | Title | Details |
|---|-----------|-------|---------|
| 4.14 | `phase4-14-graph-types` | Graph Data Types | Define `GraphNode` (id, title, color, depth, childrenCount), `GraphLink` (source, target). Transform `PageTreeNode[]` → node/link arrays for rendering. |
| 4.15 | `phase4-15-graph-renderer` | Graph Renderer Component | Use **D3.js force-directed** or **Cytoscape.js** or **React Flow** (evaluate bundle size). Canvas/WebGL for performance (>500 nodes). Features: pan/zoom, click node → navigate to page, hover → tooltip, drag to reposition (persist positions?). Color by depth or calendar. |
| 4.16 | `phase4-16-graph-ui` | Graph View UI | New route `/notes/graph` or tab in Notes workspace. Sidebar legend (depth colors). Toolbar: reset view, fit to screen, toggle physics. Loading skeleton while computing layout. |
| 4.17 | `phase4-17-graph-perf` | Performance Optimization | Virtualize nodes (only render visible), debounce layout on data change, memoize transform. Web Worker for force simulation if >200 nodes. |

---

### D. Packaging & Distribution (Launch Readiness)

| # | Ticket ID | Title | Details |
|---|-----------|-------|---------|
| 4.18 | `phase4-18-electron-builder` | electron-builder Config | Configure `electron-builder` in `package.json` / `electron-builder.yml`. Targets: `nsis` (Windows), `dmg` (macOS), `AppImage` (Linux). App ID, product name, copyright, icons. |
| 4.19 | `phase4-19-auto-updater` | Auto-Updater Integration | Add `electron-updater`. Configure update server (GitHub Releases or custom). Check on startup, background download, prompt to install. Handle `autoUpdater` events in main, expose to renderer for UI. |
| 4.20 | `phase4-20-code-signing` | Code Signing & Notarization Prep | Windows: Authenticode cert (EV or standard). macOS: Developer ID + notarization (`notarytool`). Linux: GPG sign AppImage. CI secrets configuration. |
| 4.21 | `phase4-21-ci-release` | CI Release Pipeline | GitHub Actions workflow: `release.yml` on tag push. Run typecheck, lint, test, build, sign, notarize, upload artifacts to GitHub Release. Generate changelog from conventional commits. |
| 4.22 | `phase4-22-app-icon-assets` | App Icons & Branding | Generate icon sets: Windows `.ico` (256, 128, 64, 32, 16), macOS `.icns` (512–16), Linux PNG (512, 256, 128). Splash screen / DMG background. |
| 4.23 | `phase4-23-native-menus` | Native Application Menus | Implement `Menu.buildFromTemplate` in main: File, Edit, View, Window, Help. Keyboard shortcuts (Cmd/Ctrl+N, ,, Q, etc.). Context menus for assignment list, notes sidebar. |
| 4.24 | `phase4-24-protocol-handler` | `courseflow://` Protocol | Register custom protocol (`courseflow://open?page=...`, `courseflow://sync`). Handle in main process, route to renderer via IPC. NSIS/DMG/AppImage registration. |

---

### E. Polish & Integration

| # | Ticket ID | Title | Details |
|---|-----------|-------|---------|
| 4.25 | `phase4-25-onboarding` | First-Run Onboarding | Welcome screen: explain iCal URL, demo calendar, create first calendar source, tour of features (priority, sub-tasks, notes, Pomodoro). Skip option. |
| 4.26 | `phase4-26-keyboard-shortcuts` | Global Keyboard Shortcuts | Register global shortcuts (Electron `globalShortcut`): Cmd/Ctrl+Shift+Space → toggle Pomodoro, Cmd/Ctrl+K → command palette/search. Settings to customize. |
| 4.27 | `phase4-27-accessibility-audit` | Accessibility Audit & Fixes | Full WCAG 2.1 AA audit on new UI (calendars settings, Pomodoro, graph). Playwright + axe-core E2E. Focus management, ARIA, color contrast, reduced motion. |
| 4.28 | `phase4-28-performance` | Performance Profiling | Profile startup time, memory usage, sync duration with 1000+ assignments. Optimize: lazy-load notes workspace, virtualize assignment list, memoize selectors. |
| 4.29 | `phase4-29-tests-docs` | Tests & Documentation | Unit tests (calendars repo/IPC, Pomodoro store, graph transform). Component tests (CalendarsSettings, PomodoroTimer, GraphView). E2E (multi-calendar sync, Pomodoro flow). Update `docs/architecture/data-model.md`, `ipc-contract.md`, `multi-calendar.md`, root README. |

---

## Non-Coding Actions & Design Decisions (Resolve Early)

### Architecture & Product Decisions

- [ ] **Calendar source color generation** — Deterministic hash from name (like course colors) or user-picked from palette? **Recommendation:** User-picked from 12-color palette; fallback to deterministic hash.
- [ ] **Default calendar on migration** — Seed one `CalendarSource` from existing `settings.icalUrl` with name "Primary Calendar" (or derive from feed). User can rename.
- [ ] **Unified list sort order** — When multiple calendars, how to interleave? **Recommendation:** Global priority order still applies across all sources; new assignments from any source append to end of priority order.
- [ ] **Conflict: same UID from different feeds** — Two calendars could emit same `ical_uid` (e.g., shared event). Dedupe key becomes `(source_id, ical_uid)` — already in migration v6 design.
- [ ] **Scheduler: parallel vs sequential** — Sequential is safer (rate limits, simpler error isolation). **Decision:** Sequential with per-source timeout (30s).
- [ ] **Pomodoro: persist session state** — Survive app restart? **Recommendation:** No — timer is ephemeral. Only persist config + session count.
- [ ] **Graph: layout algorithm** — Force-directed (D3) vs hierarchical (Dagre) vs radial. **Recommendation:** Force-directed for exploration, hierarchical toggle for structure.
- [ ] **Graph: persist node positions** — User-dragged positions saved to `pages.graph_x`, `graph_y`? **Defer to post-launch** — adds schema complexity.
- [ ] **Auto-updater: update channel** — GitHub Releases (public) or custom? **Recommendation:** GitHub Releases for simplicity; private repo needs token.

### Environment & Dependencies

- [ ] **Add `electron-builder`** — `pnpm add -D electron-builder`
- [ ] **Add `electron-updater`** — `pnpm add electron-updater`
- [ ] **Graph library evaluation** — `d3-force` (small, flexible), `cytoscape` (batteries included), `reactflow` (React-native, larger). **Recommendation:** `d3-force` + custom Canvas renderer for performance.
- [ ] **Add `@types/d3-force`** if using D3.
- [ ] **Sound file** — Bundle a subtle `.wav` for Pomodoro completion (or use Web Audio API oscillator).

---

## Deliverables

By the end of Phase 4:

- ✅ **Multi-Calendar**: Manage N feeds in Settings, unified list with color badges, per-source sync status, per-source error handling
- ✅ **Pomodoro Timer**: Configurable timer in TopBar with notifications/sound, session tracking
- ✅ **Notes Graph**: Interactive visualization of page hierarchy, pan/zoom, click-to-navigate
- ✅ **Packaging**: Signed installers for Windows/macOS/Linux, auto-updater functional
- ✅ **Native Menus**: Full macOS/Windows/Linux menu bar with keyboard shortcuts
- ✅ **Protocol Handler**: `courseflow://` deep links work
- ✅ **Onboarding**: First-run experience for new users
- ✅ **Tests**: Unit + component + E2E coverage for all new features
- ✅ **Docs**: Architecture docs updated, README reflects v0.4 features

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `docs/roadmap.md` | High-level phase overview (Phase 4 = v0.4) |
| `docs/architecture/multi-calendar.md` | Detailed multi-calendar design & data model |
| `docs/architecture/data-model.md` | Entity definitions (includes `CalendarSource`, `Page`) |
| `docs/architecture/ipc-contract.md` | IPC channels (includes `db:calendars:*`) |
| `docs/architecture/security.md` | Encryption design (reused for multi-feed) |
| `docs/architecture/accessibility.md` | WCAG 2.1 AA standards (apply to new UI) |

---

_Detailed task tickets for this phase are tracked under `docs/tickets/phase4/`._