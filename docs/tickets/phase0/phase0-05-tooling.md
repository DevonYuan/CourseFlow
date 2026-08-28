# Ticket: phase0-05-tooling

**Phase:** 0 — Foundations & Tooling  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Harden the developer tooling configured in the scaffold (phase0-01) with project-specific rules, strict TypeScript project references, and CI-ready configuration. This ticket ensures the codebase stays consistent and catchable by automation.

---

## Requirements

### Functional

- **TypeScript Project References**: Root `tsconfig.json` + 4 sub-configs (`main`, `preload`, `renderer`, `shared`) with `composite: true`; `pnpm typecheck` runs `tsc --build` (fast incremental)
- **ESLint Flat Config** (`eslint.config.js`): TypeScript ESLint, import/order, React hooks, no-restricted-imports (enforce process boundaries), unicorn rules
- **Prettier**: Single config at root (`.prettierrc`) — 100 cols, single quotes, trailing commas, no semi optional (choose one)
- **Vitest**: Two environments — `node` for main/preload/shared, `jsdom` for renderer; coverage thresholds (lines/branches/functions/statements ≥ 80% eventually, 0% for scaffold)
- **Husky + lint-staged**: Pre-commit runs ESLint + Prettier on staged files only; commit-msg hook for conventional commits (optional, can defer)

### Non-Functional

- `pnpm lint` exits non-zero on any warning/error (CI mode)
- `pnpm format --check` exits non-zero on formatting diffs (CI mode)
- `pnpm typecheck` exits non-zero on any type error
- `pnpm test` runs in CI mode (no watch, coverage=false by default)
- All configs committed (no local overrides)

---

## Designs & Constraints

### TypeScript Project References Structure

```
config/tsconfig.json                     # Root: references = ["./tsconfig.backend.main.json", ...]
config/tsconfig.backend.main.json        # { "compilerOptions": { "outDir": "../dist/backend/main", "rootDir": "../src/backend/main" }, "include": ["../src/backend/main"] }
config/tsconfig.backend.preload.json     # ... outDir: "../dist/backend/preload", rootDir: "../src/backend/preload"
config/tsconfig.frontend.json            # ... outDir: "../dist/frontend", rootDir: "../src/frontend", jsx: "react-jsx"
config/tsconfig.backend.shared.json      # ... outDir: "../dist/backend/shared", rootDir: "../src/backend/shared"
```

### ESLint Flat Config (eslint.config.js)

```js
export default [
  { ignores: ['dist/', 'node_modules/', '*.config.*', '*.local', 'config/'] },
  // TypeScript base
  ...tseslint.configs.recommended,
  // Import ordering
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/frontend',
              from: './src/backend/main',
              message: 'Renderer cannot import from main',
            },
            {
              target: './src/frontend',
              from: './src/backend/preload',
              message: 'Renderer cannot import from preload',
            },
            {
              target: './src/backend/main',
              from: './src/frontend',
              message: 'Main cannot import from renderer',
            },
            {
              target: './src/backend/preload',
              from: './src/frontend',
              message: 'Preload cannot import from renderer',
            },
          ],
        },
      ],
    },
  },
  // React hooks
  ...reactHooks.configs.recommended,
  // Unicorn (opinionated good practices)
  ...unicorn.configs.recommended,
  // Prettier compat (turn off conflicting rules)
  ...prettierConfig,
];
```

### Vitest Config (vitest.config.ts)

```ts
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'main', environment: 'node', include: ['src/main/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'preload', environment: 'node', include: ['src/preload/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'shared', environment: 'node', include: ['src/shared/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.tsx'],
          setupFiles: ['src/renderer/test-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 },
    }, // Raise in Phase 1
  },
});
```

---

## Code Changes

### Modified Files

- `tsconfig.json` / `tsconfig.*.json` — add `composite`, `declarationMap`, `tsBuildInfoFile`
- `eslint.config.js` — flat config as above
- `.prettierrc` — finalize options
- `vitest.config.ts` — multi-project config
- `.husky/pre-commit` — `npx lint-staged`
- `package.json` — add `lint-staged` config, ensure scripts use `--if-present` where appropriate

### New Files

- `src/renderer/test-setup.ts` — `@testing-library/jest-dom`, React 18 act compat
- `.github/workflows/ci.yml` — minimal CI (install, lint, typecheck, test, build) — _optional, can defer to Phase 1_

---

## Acceptance Criteria

| #   | Criterion                                                                  | Verification                 |
| --- | -------------------------------------------------------------------------- | ---------------------------- |
| 1   | `pnpm typecheck` runs `tsc --build` and passes (incremental on second run) | Run twice                    |
| 2   | `pnpm lint` passes on scaffold code                                        | Run                          |
| 3   | `pnpm lint` fails on intentional violation (e.g., renderer importing main) | Add bad import, run          |
| 4   | `pnpm format --check` passes on scaffold                                   | Run                          |
| 5   | `pnpm format --check` fails on unformatted file                            | Edit file, run               |
| 6   | `pnpm test` runs all 4 project suites, exits 0                             | Run                          |
| 7   | Pre-commit hook blocks commit on lint/format error                         | Stage bad file, `git commit` |
| 8   | Import restriction rules prevent cross-process imports                     | `pnpm lint` on violation     |

---

## Notes

- This ticket **complements** phase0-01 (scaffold) — it hardens configs that were "good enough" initially.
- The import restrictions are the **key architectural guardrail** — they enforce the process boundaries from phase0-02 at lint time.
- Coverage thresholds start at 0%; raise to 80% in Phase 1 when real code exists.
- CI workflow is optional here but recommended; if skipped, add a note to Phase 1 kickoff.

---

## Release Summary

> **What:** Strict TypeScript project references, ESLint flat config with architectural import guards, Prettier, Vitest multi-project, Husky pre-commit.  
> **Why:** Automates code quality and enforces the process-boundary architecture continuously.  
> **Impact:** Developer experience only — no user-facing change. Future PRs fail fast on violations.
