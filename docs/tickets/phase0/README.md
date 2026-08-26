# Phase 0 — Foundation (Scaffold)

> **Goal:** Lay the project skeleton and prove the core toolchain works end-to-end before any feature work begins.
>
> **Exit criteria:** A scaffolded Electron + React + TypeScript app runs cleanly, the SQLite schema migrates on first launch, and a simple end-to-end proof (IPC round-trip) works.

## Scope in one line

Set up the project, establish the app architecture, wire up the database, and lock in tooling — **without** building any Canvas/iCal feature yet.

## Coding Objectives

### 1. Project scaffold

- Initialize an **Electron + React + TypeScript** project using **electron-vite** (integrated bundler for main/preload/renderer with HMR).
- Packaging via **electron-builder** will be added later (Phase 4) for cross-platform installers.
- Verify the app launches a window and hot-reloads during dev.

### 2. App architecture — process split

- Establish the **backend/frontend** split:
  - **Backend (Main + Preload + Shared)** — app lifecycle, window management, iCal fetch/parse (later), SQLite access, safe typed API via `contextBridge`, shared TypeScript types/utilities.
  - **Frontend (Renderer)** — React UI, state management.
- Enable secure defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox` as appropriate.

### 3. SQLite layer

- Use the built-in **`node:sqlite`** driver (no native module compilation needed).
- Define the **initial schema** and a **migration mechanism** so the DB is created/upgraded on first launch.
- Write a tiny migration runner that runs on app startup.

### 4. IPC / typed bridge

- Establish an IPC pattern (main ⇄ preload ⇄ renderer).
- Prove the round-trip with a minimal example (e.g., a ping/pong or reading DB version from the renderer).
- Keep the preload surface strictly typed (shared TypeScript types).

### 5. Tooling baseline

- **Lint** (ESLint + TypeScript config).
- **Formatting** (Prettier).
- Confirm **Node.js 24 LTS** and the chosen package manager (**pnpm**) are documented/pinned.
- Optional: minimal CI config to run lint/typecheck/build.

### 6. Repository hygiene

- `.gitignore` (node_modules, build/dist output, editor files).
- Basic README note on how to run the dev app.

## Non-Coding Actions

> Tasks that must happen outside of writing feature code — these are often blockers for the coding work.

### Environment & setup

- [x] **Node.js 24 LTS** installed and pinned via fnm (see `.node-version` at project root).
- [x] Package manager: **pnpm** installed globally.
- [x] SQLite driver: **`node:sqlite`** (built into Node — no native build toolchain needed on Windows).
- [ ] Confirm Electron can run in the local dev environment (GPU/display/sandbox quirks on Windows).

### Architecture decisions (resolve before/early coding)

- [x] ~~Confirm the bundler choice~~ — **resolved:** `electron-vite` (dev/build) + `electron-builder` (packaging, Phase 4).
- [x] ~~Lock the SQLite driver~~ — **resolved:** `node:sqlite` (no native build requirements).
- [x] **State management** — **resolved:** **Zustand** for renderer (per repo memory).
- [x] **Folder structure** — **resolved:** `src/backend` (main, preload, shared), `src/frontend` (renderer) (see phase0-01-scaffold).
- [x] **DB schema v1** — **resolved:** Assignments, PriorityOrder, SubTasks, Notes, Settings + migrations (see phase0-03-sqlite).

### Product / data

- [x] **Data model fields confirmed** — see `docs/architecture/data-model.md` (phase0-06-hygiene).
- [x] **iCal URL storage** — **resolved:** encrypted in SQLite `settings` table via Web Crypto (see `docs/architecture/security.md`).

### Process & hygiene

- [x] **Commit conventions** — **resolved:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) (phase0-06-hygiene).
- [x] **Phase 0 tickets created** — see `docs/tickets/phase0/phase0-0[1-6]-*.md`.
- [x] **Project conventions** — lint/format/typecheck/test scripts documented in `package.json` and `README.md`.
- [x] **Licensing** — MIT license added (phase0-06-hygiene).

## Deliverables

By the end of Phase 0:

- [ ] Skeleton repo with Electron + React + TypeScript running.
- [ ] Main / preload / renderer split with secure defaults.
- [ ] SQLite initialized with v1 schema + migration runner.
- [ ] Working typed IPC round-trip.
- [ ] Lint + format configured (runnable locally).
- [ ] The above non-coding checklist resolved.

_Detailed task tickets for this phase are tracked under `docs/tickets/phase0/`._

---

## Tickets (this phase)

| ID                       | Title                                   | Description                                                                                                                                                              |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `phase0-01-scaffold`     | **Project Scaffold**                    | Initialize Electron + React + TS with electron-vite, electron-builder, pnpm, ESLint, Prettier, Vitest, Husky. Produces runnable "Hello World" app.                       |
| `phase0-02-architecture` | **Process Architecture & IPC Contract** | Document three-process model, define typed IPC channels/payloads/events in `src/shared/ipc.ts`, domain types in `src/shared/types.ts`, contextBridge pattern.            |
| `phase0-03-sqlite`       | **SQLite Database Layer**               | Implement `node:sqlite` connection, v1 schema (assignments, priority_order, sub_tasks, notes, settings, schema_version), migration runner, typed synchronous repository. |
| `phase0-04-ipc`          | **IPC Wiring**                          | Connect IPC contract to SQLite repository: implement all handlers, emit `db:changed` events, expose full typed `window.api` in preload.                                  |
| `phase0-05-tooling`      | **Tooling Hardening**                   | TS project references, ESLint flat config with architectural import guards, Prettier, Vitest multi-project, Husky pre-commit with lint-staged.                           |
| `phase0-06-hygiene`      | **Repository Hygiene & Decisions**      | Commit `.node-version`, add MIT license, document commit conventions, confirm data model fields, design iCal URL encryption, verify Windows Electron.                    | *   |
