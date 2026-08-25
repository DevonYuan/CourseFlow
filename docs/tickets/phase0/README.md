# Phase 0 — Foundation (Scaffold)

> **Goal:** Lay the project skeleton and prove the core toolchain works end-to-end before any feature work begins.
>
> **Exit criteria:** A scaffolded Electron + React + TypeScript app runs cleanly, the SQLite schema migrates on first launch, and a simple end-to-end proof (IPC round-trip) works.


## Scope in one line

Set up the project, establish the app architecture, wire up the database, and lock in tooling — **without** building any Canvas/iCal feature yet.


## Coding Objectives

### 1. Project scaffold
- Initialize an **Electron + React + TypeScript** project.
- Decide the bundler/build tooling. Recommended: **Vite** for the renderer + **electron-builder** (or electron-vite) for packaging/main.
- Verify the app launches a window and hot-reloads during dev.

### 2. App architecture — process split
- Establish the three-way split:
  - **Main process** — app lifecycle, window management, iCal fetch/parse (later), SQLite access.
  - **Preload** — exposes a safe, typed API to the renderer via `contextBridge`.
  - **Renderer** — React UI, state management.
- Enable secure defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox` as appropriate.

### 3. SQLite layer
- Add SQLite integration (e.g., `better-sqlite3`).
- Define the **initial schema** and a **migration mechanism** so the DB is created/upgraded on first launch.
- Write a tiny migration runner that runs on app startup.

### 4. IPC / typed bridge
- Establish an IPC pattern (main ⇄ preload ⇄ renderer).
- Prove the round-trip with a minimal example (e.g., a ping/pong or reading DB version from the renderer).
- Keep the preload surface strictly typed (shared TypeScript types).

### 5. Tooling baseline
- **Lint** (ESLint + TypeScript config).
- **Formatting** (Prettier).
- Confirm **Node.js 20 LTS** and the chosen package manager are documented/pinned.
- Optional: minimal CI config to run lint/typecheck/build.

### 6. Repository hygiene
- `.gitignore` (node_modules, build/dist output, editor files).
- Basic README note on how to run the dev app.


## Non-Coding Actions

> Tasks that must happen outside of writing feature code — these are often blockers for the coding work.

### Environment & setup
- [ ] Install **Node.js 20 LTS** (pin version in `.nvmrc` or `.node-version`).
- [ ] Choose and install a **package manager** (recommended: **pnpm** or the latest npm bundled with Node 20).
- [ ] Verify native module toolchain works on Windows (SQLite is a native dependency) — confirm build tools / VS Build Tools are available so `better-sqlite3` compiles.
- [ ] Confirm Electron can run in the local dev environment (GPU/display/sandbox quirks on Windows).

### Architecture decisions (resolve before/early coding)
- [ ] Confirm the bundler choice: **electron-vite** vs. separate Vite + electron-builder setup.
- [ ] Lock the **SQLite driver** (`better-sqlite3` vs. alternatives) — affects native build requirements.
- [ ] Decide **state management** approach for the renderer (Context + hooks vs. Zustand/Redux) — aligns with Phase 1+
- [ ] Finalize the **folder structure** (e.g., `src/main`, `src/preload`, `src/renderer`, `src/shared`).
- [ ] Define the **DB schema** v1 (Assignments, PriorityOrder, SubTasks, Notes) and how migrations are structured.

### Product / data
- [ ] Confirm the data model fields we need up front (so the v1 schema is stable).
- [ ] Note where the iCal URL will live (user setting, stored how?) — informs DB/architecture now even if implemented later.

### Process & hygiene
- [ ] Agree on commit conventions / PR process (even if solo).
- [ ] Create the `tickets/phase0/` breakdown into specific tickets (the actionable list for this phase).
- [ ] Add project conventions to a `docs/` or README (lint/format commands).
- [ ] Confirm licensing note (from root README) is not a blocker for Phase 0.


## Deliverables

By the end of Phase 0:
- [ ] Skeleton repo with Electron + React + TypeScript running.
- [ ] Main / preload / renderer split with secure defaults.
- [ ] SQLite initialized with v1 schema + migration runner.
- [ ] Working typed IPC round-trip.
- [ ] Lint + format configured (runnable locally).
- [ ] The above non-coding checklist resolved.


*Detailed task tickets for this phase are tracked under `docs/tickets/phase0/`.*