# Ticket: phase0-06-hygiene
**Phase:** 0 — Foundations & Tooling  
**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 0.5 day  

---

## Description
Address the remaining non-coding "open decisions" from `docs/tickets/phase0/README.md` and repository hygiene items. This ticket produces committed decisions and minimal docs so Phase 1 starts with zero ambiguity.

---

## Requirements
### Functional
- Commit `.node-version` (Node 24) to git
- Add `LICENSE` (MIT recommended) and update `package.json` `license` field
- Define and document **commit message convention** (Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`)
- Confirm **data model fields** for Assignment (match Canvas iCal + user extensions) — write to `docs/architecture/data-model.md`
- Decide and document **iCal URL storage**: encrypted in SQLite `settings` table (key `ical_url`) — use `crypto.subtle` (Web Crypto) via main process; store only ciphertext + IV + salt
- Document **auto-sync interval** setting (default: 15 min, user-configurable)
- Verify **Electron runs locally on Windows** (GPU/sandbox) — record any flags needed in `docs/architecture/windows-notes.md`

### Non-Functional
- All decisions written as Markdown in `docs/architecture/` — not just verbal
- No code changes required (except adding LICENSE file)
- Encryption design documented; implementation deferred to Phase 1 (settings ticket)

---

## Designs & Constraints
### Commit Convention (Conventional Commits)
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`
Scope examples: `main`, `renderer`, `preload`, `shared`, `db`, `ipc`, `ical`, `ui`, `deps`

### Data Model Confirmation (docs/architecture/data-model.md)
| Entity | Fields | Source |
|--------|--------|--------|
| **Assignment** | id, canvas_id, title, description, course_name, course_color, due_at, unlock_at, lock_at, points_possible, submission_types, workflow_state, html_url, ical_uid, created_at, updated_at | iCal + Canvas API + user |
| **PriorityOrder** | assignment_id, position | User drag-drop |
| **SubTask** | id, assignment_id, title, completed, position, created_at, updated_at | User |
| **Note** | assignment_id, content, updated_at | User |
| **Settings** | key, value (JSON) | User + app |

### iCal URL Encryption Design
- **Algorithm**: AES-GCM 256-bit (Web Crypto `crypto.subtle`)
- **Key derivation**: PBKDF2 from user password (or app-generated key stored in OS keychain via `electron-store` / `keytar` — decide in Phase 1)
- **Stored in SQLite**: `{ ciphertext: base64, iv: base64, salt: base64 }` as JSON string in `settings.value` for key `ical_url`
- **Main process only** — renderer never sees plaintext URL
- **Phase 1 implementation**: settings ticket adds `setEncryptedSetting` / `getDecryptedSetting` repository methods

### Windows Electron Notes (docs/architecture/windows-notes.md)
- Test `pnpm dev` on Windows — note any `--disable-gpu`, `--no-sandbox`, or `app.commandLine.appendSwitch` needed
- Record `electron-builder` NSIS installer behavior (per-user vs machine-wide)
- Note any `node:sqlite` native module rebuild issues (should be none — built-in)

---

## Code Changes
### New Files
- `LICENSE` (MIT)
- `docs/architecture/data-model.md`
- `docs/architecture/windows-notes.md`
- `docs/architecture/security.md` (encryption design for iCal URL)

### Modified Files
- `.gitignore` (ensure `.node-version` is **not** ignored)
- `package.json` (add `license: "MIT"`)
- `README.md` (add commit convention badge/link)

---

## Acceptance Criteria
| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `.node-version` is tracked by git (`git ls-files .node-version` shows it) | Run |
| 2 | `LICENSE` file exists with MIT text | `cat LICENSE` |
| 3 | `package.json` has `"license": "MIT"` | Check |
| 4 | `docs/architecture/data-model.md` lists all entities + fields + sources | Review |
| 5 | `docs/architecture/security.md` documents iCal URL encryption design | Review |
| 6 | `docs/architecture/windows-notes.md` records any Windows-specific Electron flags | Review (or "None needed") |
| 7 | Commit convention documented in `README.md` or `CONTRIBUTING.md` | Check |

---

## Notes
- This ticket **resolves** all remaining open items in `docs/tickets/phase0/README.md`:
  - ✅ `.node-version` committed
  - ✅ Licensing
  - ✅ Commit conventions
  - ✅ Data model fields confirmed
  - ✅ iCal URL storage decision (encrypted)
  - ✅ Electron on Windows verified
- The encryption *implementation* is **not** in this ticket — it's a Phase 1 settings feature. This ticket only documents the design.
- If Windows testing reveals no issues, `windows-notes.md` simply states "Verified: no special flags required on Windows 10/11 with Node 24 / Electron 32+."

---

## Release Summary
> **What:** Committed `.node-version`, added MIT license, documented commit conventions, confirmed data model fields, designed iCal URL encryption, verified Windows Electron compatibility.  
> **Why:** Eliminates all Phase 0 ambiguity; Phase 1 tickets can reference these decisions directly.  
> **Impact:** Documentation and repo hygiene only. No code behavior change.