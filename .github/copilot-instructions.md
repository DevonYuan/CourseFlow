---
description: 'Use when implementing features, running tests, or executing commands that spawn backend, frontend, or Node.js processes. Ensures proper cleanup to prevent memory/CPU leaks from orphaned processes.'
applyTo: '**'
---

# Process Cleanup Guidelines

## ALWAYS Clean Up After Implementation

After completing any task that spawns processes, you MUST verify and clean up:

### Backend Processes (Electron Main Process)

- Kill any `electron` or `node` processes running the main entry point (`src/backend/main/index.ts`)
- Check for processes on IPC ports (default: 9999 or configured port)
- Use `pkill -f "electron.*main"` or `pkill -f "node.*main/index"`

### Frontend Processes (Vite/React Dev Server)

- Kill any `vite` dev server processes
- Kill any `node` processes running the frontend entry (`src/frontend/src/main.tsx`)
- Check ports 5173 (Vite default) and 3000 (common alternative)
- Use `pkill -f "vite"` or `lsof -ti:5173 | xargs kill -9`

### Test Processes (Vitest)

- Kill any `vitest` processes after test runs complete
- Check for orphaned test workers
- Use `pkill -f "vitest"` or `npx vitest --run` (run mode exits cleanly)

### Additional Node Processes

- Kill any `tsc --watch` TypeScript compilation watchers
- Kill any `eslint --watch` or linting watchers
- Kill any custom scripts spawned via `run_in_terminal` with `mode: async`
- Check for processes using project-specific ports

## Cleanup Commands Reference

```bash
# Kill all Electron processes for this project
pkill -f "CourseFlow.*electron" || true

# Kill Vite dev server
pkill -f "vite" || true
lsof -ti:5173 | xargs -r kill -9

# Kill Vitest processes
pkill -f "vitest" || true

# Kill TypeScript watchers
pkill -f "tsc.*--watch" || true

# Kill any Node processes in project directory
pkill -f "CourseFlow" || true

# Verify cleanup
ps aux | grep -E "(electron|vite|vitest|tsc.*watch)" | grep -v grep
```

## When to Run Cleanup

1. **After every implementation task** - Before reporting completion
2. **Before starting new tasks** - Ensure clean slate
3. **After test runs** - Especially `vitest` in watch mode
4. **After dev server starts** - If you started servers for testing
5. **On errors/timeouts** - Clean up failed async processes

## Verification

Always run verification after cleanup:

```bash
# Should return empty or only grep process
ps aux | grep -E "(electron|vite|vitest|tsc.*watch)" | grep -v grep
```

## Test Execution Limits (Critical for Memory/CPU)

**NEVER run tests with full parallelism.** Vitest and other test runners spawn multiple worker processes that can quickly consume all available RAM and CPU.

### Required Test Run Commands

```bash
# ✅ GOOD: Limit to 1-2 workers max, run in sequence
npx vitest run --pool=forks --poolOptions.forks.singleFork
npx vitest run --maxConcurrency=2

# ✅ GOOD: Run specific test file only (not entire suite)
npx vitest run src/backend/shared/__tests__/specific-file.test.ts

# ❌ BAD: Default parallelism (spawns many workers)
npx vitest run
npx vitest run --pool=threads

# ❌ BAD: Watch mode during implementation (keeps processes alive)
npx vitest
```

### Test Execution Rules

1. **Default to single-fork mode** — Use `--pool=forks --poolOptions.forks.singleFork` for all test runs unless explicitly debugging parallel issues
2. **Max 2 concurrent workers** — If parallelism is needed, cap at `--maxConcurrency=2`
3. **Run targeted tests** — Run specific test files or test suites, not the entire test suite at once
4. **No watch mode during implementation** — Only use watch mode for active TDD cycles; kill immediately after
5. **Cleanup between test runs** — Always run cleanup commands (see below) after ANY test execution

### Post-Test Cleanup (MANDATORY)

```bash
# After EVERY test run, verify and clean:
pkill -f "vitest" || true
pkill -f "node.*vitest" || true
ps aux | grep -E "vitest" | grep -v grep
# Should return empty
```

## Notes

- Use `|| true` to prevent command failures from stopping execution
- Prefer `pkill -f` with specific patterns over broad kills
- For async terminals started via `run_in_terminal`, use `kill_terminal` with the returned ID
- Document any persistent processes that SHOULD remain running (e.g., database servers)
- **Test processes are the #1 cause of memory exhaustion** — treat every test run as a potential leak

# Frontend Design Guidelines 
Don't use emojis. 