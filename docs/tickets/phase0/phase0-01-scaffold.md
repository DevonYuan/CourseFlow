# Ticket: phase0-01-scaffold

**Phase:** 0 — Foundations & Tooling  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 1 day

## Description

Initialize the monorepo-style workspace with the agreed-upon toolchain:

- Node 24 (pinned in `.node-version` and committed)
- pnpm as package manager
- electron-vite for build (Vite + Electron integration)
- electron-builder for packaging
- TypeScript in strict mode across all processes
- ESLint (typescript-eslint, import plugin) + Prettier
- Vitest for unit/integration tests
- Husky + lint-staged for pre-commit hooks

The scaffold must produce a runnable "Hello World" Electron window (main + renderer) that compiles, lints, tests, and packages without errors.

## Requirements

### Functional

- `pnpm install` succeeds on a clean machine with Node 24
- `pnpm dev` launches the Electron app in development (hot reload for renderer, restart for main/preload)
- `pnpm build` produces distributable artifacts via electron-builder
- `pnpm test` runs the test suite (initially empty but configured)
- `pnpm lint` / `pnpm format` work

### Non-Functional

- TypeScript `strict: true` everywhere
- No `any` in scaffold code (except deliberate `unknown` narrowings)
- Source maps enabled for debugging
- Build output goes to `dist/` (ignored by git)

## Designs & Constraints

- **Folder structure** (finalize the open item from `docs/tickets/phase0/README.md`):
  ```
  src/
    backend/       # Backend (Electron Main + Preload)
      main/        # Main process (Node + Electron APIs)
      preload/     # Preload scripts (contextBridge)
      shared/      # Pure TS shared types/utilities (no Electron/Node deps)
    frontend/      # Frontend (React + Vite)
      src/         # React source
      index.html   # Vite entry HTML
  ```
- **Package.json scripts** (exact names):
  - `dev` — `electron-vite dev`
  - `build` — `electron-vite build && electron-builder`
  - `preview` — `electron-vite preview`
  - `lint` — `eslint . --ext ts,tsx --max-warnings 0`
  - `format` — `prettier --write .`
  - `test` — `vitest run`
  - `test:watch` — `vitest`
  - `typecheck` — `tsc --noEmit`
- **electron-vite config**: three entries (main, preload, renderer) with proper `outDir` mapping to `dist/`
- **electron-builder config**: NSIS for Windows, `appId: "com.courseflow.app"`, `productName: "CourseFlow"`
- **TSConfig**: project references (`tsconfig.json` root + `tsconfig.main.json`, `tsconfig.preload.json`, `tsconfig.renderer.json`, `tsconfig.shared.json`)
- **ESLint**: `typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-react-hooks`; `import/order` enforced
- **Prettier**: single quotes, trailing commas, 100 char line width
- **Husky**: `pre-commit` runs `lint-staged` (ESLint + Prettier on staged files)

## Code Changes

### New Files

- `.node-version` (commit the existing file)
- `package.json`
- `pnpm-lock.yaml` (generated)
- `tsconfig.json` + per-process TSConfigs
- `electron.vite.config.ts`
- `electron-builder.json` (or `build` field in package.json)
- `.eslintrc.cjs` / `eslint.config.js` (flat config preferred)
- `.prettierrc`
- `.husky/pre-commit`
- `src/backend/main/index.ts` (minimal main process: create window, load renderer)
- `src/backend/preload/index.ts` (minimal preload: expose nothing yet, contextBridge ready)
- `src/backend/shared/types.ts` (empty barrel export)
- `src/frontend/index.html` + `src/frontend/src/main.tsx` + `App.tsx` (React 18 + TSX)
- `vitest.config.ts` (renderer + main environments)
- `README.md` (update with dev commands)

### Modified Files

- `.gitignore` (add `dist/`, `node_modules/`, `*.local`, `.vite/`, `.electron-vite/`)

## Acceptance Criteria

| #   | Criterion                                                                                         | Verification                   |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | `pnpm install` completes without errors                                                           | Run on clean checkout          |
| 2   | `pnpm dev` opens an Electron window showing "CourseFlow" title and a React-rendered "Hello World" | Visual check                   |
| 3   | `pnpm build` produces installer in `dist/` (`.exe` for Windows)                                   | File exists                    |
| 4   | `pnpm lint` passes with 0 warnings                                                                | CI-style run                   |
| 5   | `pnpm format` makes no changes on scaffold code                                                   | Run twice, second is no-op     |
| 6   | `pnpm typecheck` passes (no errors)                                                               | Run                            |
| 7   | `pnpm test` exits 0 (empty suite configured)                                                      | Run                            |
| 8   | Pre-commit hook blocks commit on lint/format failure                                              | Stage bad file, attempt commit |

## Notes

- This ticket **resolves** the "Finalize folder structure" and "Confirm electron-vite + electron-builder" open items in `docs/tickets/phase0/README.md`.
- Keep the scaffold minimal — no business logic, no SQLite, no IPC yet. Those are separate tickets.
- Use `node:sqlite` (native) — do **not** add `better-sqlite3` or `sqlite3` npm packages.
- React 18 with functional components + hooks only.
- Zustand is **already decided** for renderer state (per repo memory); do not install it here — wait for the state-management ticket in Phase 1.

## Release Summary

> **What:** Initialized CourseFlow Electron + React + TypeScript workspace with electron-vite, electron-builder, pnpm, ESLint, Prettier, Vitest, Husky.  
> **Why:** Establishes the entire developer experience and CI baseline before any feature work.  
> **Impact:** All subsequent tickets depend on this scaffold. Zero runtime features delivered.
