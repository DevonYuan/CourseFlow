---
description: "Use when implementing features, running tests, or executing commands that spawn backend, frontend, or Node.js processes. Ensures proper cleanup to prevent memory/CPU leaks from orphaned processes."
applyTo: "**"
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

## Notes

- Use `|| true` to prevent command failures from stopping execution
- Prefer `pkill -f` with specific patterns over broad kills
- For async terminals started via `run_in_terminal`, use `kill_terminal` with the returned ID
- Document any persistent processes that SHOULD remain running (e.g., database servers)