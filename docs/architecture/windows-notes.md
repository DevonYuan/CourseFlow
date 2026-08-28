# Windows Development Notes

This document records findings from running Electron on Windows during Phase 0 verification.

## Test Environment

- **OS**: Windows 11
- **Node**: 24.x (via `.node-version`)
- **Package Manager**: pnpm 9.12.0
- **Electron**: 34.5.8
- **Electron Vite**: 2.1.0

## `pnpm dev` — Development Server

**Result: ✅ Works without flags**

Command runs successfully:

```bash
pnpm dev
```

**Output:**

- Vite builds main process bundle (~28 kB)
- Vite builds preload bundle (~2 kB)
- Dev server starts at `http://localhost:5173/`
- Electron app window opens and renders React frontend

**Console Errors (Benign):**

```
[ERROR:CONSOLE(1)] "Request Autofill.enable failed. {'code':-32601,'message':'Autofill.enable wasn't found'}"
[ERROR:CONSOLE(1)] "Request Autofill.setAddresses failed. {'code':-32601,'message':'Autofill.setAddresses wasn't found'}"
```

These are DevTools protocol messages — Chrome DevTools trying to enable Autofill domain which isn't implemented in Electron's DevTools. No impact on app functionality.

**No GPU/sandbox flags needed** — Default Electron 34 configuration works out of the box on Windows 11.

---

## `pnpm build` — Production Build

**Not yet tested** — Will verify in Phase 1.

**Expected `electron-builder` NSIS installer behavior:**

- Default: **Per-user install** (no admin required)
- Install location: `%LOCALAPPDATA%\Programs\courseflow`
- Auto-updater support: Built-in via `electron-updater` (to be configured)
- Machine-wide install: Requires NSIS `perMachine` flag + admin elevation

---

## Native Modules — `node:sqlite` / `better-sqlite3`

**Current status:** Not yet integrated (Phase 0 uses `sql.js` WASM)

**Future note for `better-sqlite3` (if adopted):**

- Requires native compilation via `node-gyp` / `npm rebuild`
- Windows prerequisites:
  - Visual Studio Build Tools (or full VS) with C++ workload
  - Python 3.x (for `node-gyp`)
- `pnpm rebuild` or `electron-rebuild` handles Electron ABI targeting
- Prebuilt binaries available for Windows x64 — usually no manual rebuild needed

**`sql.js` (current choice):**

- Pure WebAssembly — **no native compilation needed**
- Works identically across platforms
- No Windows-specific issues expected

---

## Recommended `app.commandLine.appendSwitch` (if needed later)

| Flag                     | Purpose                     | When to Use                                             |
| ------------------------ | --------------------------- | ------------------------------------------------------- |
| `--disable-gpu`          | Disable GPU acceleration    | If rendering issues / black screen on specific hardware |
| `--disable-gpu-sandbox`  | Disable GPU process sandbox | Rare Windows sandbox conflicts                          |
| `--no-sandbox`           | Disable all sandboxing      | **Not recommended** — security risk; only for debugging |
| `--enable-logging --v=1` | Verbose logging             | Debugging startup issues                                |

**Current verdict:** None required for development.

---

## Known Issues / Workarounds

### 1. DevTools Autofill Errors

- **Symptom**: Console errors about `Autofill.enable` / `Autofill.setAddresses`
- **Cause**: Electron's DevTools doesn't implement the full Chrome DevTools Protocol
- **Fix**: None needed — cosmetic only

### 2. Long Path Support

- **Issue**: Windows 260-char MAX_PATH can cause issues with deep `node_modules`
- **Fix**: Enable long paths in Windows (Group Policy or registry) or use `pnpm` (flatter node_modules)

### 3. Symlinks in `node_modules`

- **Issue**: pnpm uses symlinks; some Windows tools don't follow them
- **Fix**: Use `pnpm` commands directly; avoid `node`/`npx` on symlinked binaries

### 4. File Watching Limits

- **Issue**: Large projects may hit `ENOSPC` on file watchers
- **Fix**: Not an issue for this project size; if needed, increase `fs.inotify.max_user_watches` equivalent on Windows (registry)

---

## Verification Checklist

| Item                             | Status | Notes                       |
| -------------------------------- | ------ | --------------------------- |
| `pnpm dev` starts without errors | ✅     | Window opens, React renders |
| No `--disable-gpu` needed        | ✅     | Default works               |
| No `--no-sandbox` needed         | ✅     | Default works               |
| TypeScript compilation passes    | ✅     | `pnpm typecheck`            |
| Linting passes                   | ✅     | `pnpm lint`                 |
| Tests pass                       | ✅     | `pnpm test`                 |
| Production build works           | ⬜     | Pending Phase 1             |
| NSIS installer builds            | ⬜     | Pending Phase 1             |
| Auto-updater configured          | ⬜     | Pending Phase 1             |

---

## Next Steps (Phase 1)

1. Run `pnpm build` and verify `electron-builder` output
2. Test NSIS installer (per-user and per-machine)
3. Configure `electron-updater` for auto-updates
4. Integrate `better-sqlite3` if `sql.js` performance insufficient — verify native rebuild
