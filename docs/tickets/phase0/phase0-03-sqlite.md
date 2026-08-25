# Ticket: phase0-03-sqlite
**Phase:** 0 — Foundations & Tooling  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 1 day  

---

## Description
Implement the SQLite database layer in the main process using Node's built-in `node:sqlite` (synchronous `DatabaseSync` API). Define the v1 schema for Assignments, Priority Order, Sub-Tasks, Notes, and Settings. Provide a typed repository module that the IPC handlers will call.

---

## Requirements
### Functional
- Single `DatabaseSync` connection opened at app startup (path: `<userData>/courseflow.db`)
- Schema v1 with tables:
  - `assignments` — core assignment fields + Canvas sync metadata
  - `priority_order` — user-defined sort order (assignment_id, position)
  - `sub_tasks` — checklist items per assignment
  - `notes` — free-form notes per assignment
  - `settings` — key-value (iCal URL, theme, auto-sync interval, etc.)
  - `schema_version` — single-row migration tracking
- Repository functions (typed, synchronous) for all CRUD operations needed by Phase 1
- Migration runner: on startup, apply pending migrations sequentially; `schema_version` tracks current version
- WAL mode enabled for concurrency (renderer reads via IPC, main writes)

### Non-Functional
- **No ORM** — raw parameterized SQL only (security, simplicity, bundle size)
- All repository functions return typed objects matching `src/shared/types.ts`
- Zero `any` in repository code
- Prepared statements reused (cached in module scope)
- Foreign keys enforced (`PRAGMA foreign_keys = ON`)
- Database file excluded from git (already in `.gitignore`)

---

## Designs & Constraints
### Schema v1 (SQL)
```sql
-- Core assignments from iCal + user extensions
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,                    -- UUID v4 (generated locally) or Canvas ID
  canvas_id TEXT UNIQUE,                  -- Canvas assignment ID for dedup
  title TEXT NOT NULL,
  description TEXT,                       -- HTML from Canvas
  course_name TEXT NOT NULL,
  course_color TEXT,                      -- Hex from Canvas
  due_at INTEGER NOT NULL,                -- Unix ms (UTC)
  unlock_at INTEGER,                      -- Unix ms (UTC)
  lock_at INTEGER,                        -- Unix ms (UTC)
  points_possible REAL,
  submission_types TEXT,                  -- JSON array ['online_text_entry', ...]
  workflow_state TEXT,                    -- 'unsubmitted', 'submitted', 'graded', etc.
  html_url TEXT,                          -- Canvas URL
  ical_uid TEXT UNIQUE,                   -- iCal UID for dedup across syncs
  created_at INTEGER NOT NULL,            -- Unix ms
  updated_at INTEGER NOT NULL             -- Unix ms
);

-- User-defined priority (drag-drop order)
CREATE TABLE priority_order (
  assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL UNIQUE        -- 0 = top priority
);

-- Sub-tasks / checklist per assignment
CREATE TABLE sub_tasks (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean
  position INTEGER NOT NULL,              -- order within assignment
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Notes per assignment
CREATE TABLE notes (
  assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',       -- Markdown
  updated_at INTEGER NOT NULL
);

-- App settings (key-value, single row per key)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL                     -- JSON stringified
);

-- Migration tracking
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_assignments_due_at ON assignments(due_at);
CREATE INDEX idx_assignments_course ON assignments(course_name);
CREATE INDEX idx_sub_tasks_assignment ON sub_tasks(assignment_id, position);
```

### Repository API (src/main/db/repository.ts)
```ts
// All functions synchronous, throw on SQL error
export const repo = {
  // Assignments
  listAssignments: (): Assignment[] => ...
  getAssignment: (id: string) => Assignment | null
  upsertAssignment: (input: AssignmentInput) => Assignment
  deleteAssignment: (id: string) => void
  listAssignmentsByCourse: (course: string) => Assignment[]

  // Priority
  getPriorityOrder: () => string[]        // assignment_ids in order
  setPriorityOrder: (ids: string[]) => void

  // Sub-tasks
  listSubTasks: (assignmentId: string) => SubTask[]
  upsertSubTask: (input: SubTaskInput) => SubTask
  deleteSubTask: (id: string) => void
  reorderSubTasks: (assignmentId: string, ids: string[]) => void

  // Notes
  getNote: (assignmentId: string) => Note | null
  setNote: (assignmentId: string, content: string) => Note

  // Settings
  getSetting: <T>(key: string, defaultValue: T) => T
  setSetting: <T>(key: string, value: T) => void

  // iCal sync support
  findByICalUID: (uid: string) => Assignment | null
  bulkUpsertAssignments: (assignments: AssignmentInput[]) => Assignment[]
};
```

### Migration Runner (src/main/db/migrate.ts)
```ts
export function migrate(db: DatabaseSync): void {
  const current = db.prepare('SELECT version FROM schema_version').get()?.version ?? 0;
  const migrations: Record<number, string> = {
    1: /* schema v1 SQL */,
  };
  for (let v = current + 1; v <= Object.keys(migrations).length; v++) {
    db.exec(migrations[v]);
    db.prepare('INSERT INTO schema_version VALUES (?, ?)').run(v, Date.now());
  }
}
```

---

## Code Changes
### New Files
- `src/main/db/connection.ts` — open `DatabaseSync`, enable WAL/FK, export singleton
- `src/main/db/migrate.ts` — migration runner (called once at startup)
- `src/main/db/repository.ts` — typed repository (above)
- `src/main/db/schema.sql` — raw SQL for v1 (reference, also embedded in migrate.ts)

### Modified Files
- `src/main/index.ts` — call `migrate(db)` before creating window; attach `db` to `globalThis` or export for handlers
- `src/main/ipc-handlers.ts` — wire repository functions to IPC channel handlers (stubs from phase0-02 now implemented)

---

## Acceptance Criteria
| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | App starts, creates `courseflow.db` in `app.getPath('userData')` | Check file exists |
| 2 | `schema_version` table shows version 1 after first run | `sqlite3 courseflow.db "SELECT * FROM schema_version"` |
| 3 | All repository functions compile and return types matching `src/shared/types.ts` | `pnpm typecheck` |
| 4 | CRUD round-trip works via IPC: `window.api.db.assignments.upsert → list → get → delete` | Manual test in renderer console |
| 5 | Priority reorder persists across app restarts | Restart, verify order |
| 6 | Sub-tasks and notes cascade delete when assignment deleted | Delete assignment, verify tables empty |
| 7 | Settings get/set survives restart | Set iCal URL, restart, read back |
| 8 | WAL mode enabled (`PRAGMA journal_mode=WAL`) | `sqlite3 courseflow.db "PRAGMA journal_mode"` |
| 9 | No raw SQL in IPC handlers — all via repository | Code review |

---

## Notes
- This ticket **resolves** the "DB schema v1 (assignments, priority, sub-tasks, notes, migrations)" open item in `docs/tickets/phase0/README.md`.
- `node:sqlite` is **synchronous** — all repository functions are sync. This is fine for main process (off UI thread). Do not wrap in promises.
- UUID generation: use `crypto.randomUUID()` (Node 24 global).
- Timestamps: always Unix milliseconds (UTC) stored as `INTEGER`.
- The iCal sync ticket (Phase 1) will call `bulkUpsertAssignments` and `findByICalUID`.

---

## Release Summary
> **What:** SQLite database layer with v1 schema, migration runner, and typed synchronous repository in the main process using `node:sqlite`.  
> **Why:** Persistent local storage for all assignment data, priorities, sub-tasks, notes, and settings — the foundation for every feature.  
> **Impact:** IPC handlers from phase0-02 now return real data. Renderer can persist user changes. Zero UI delivered.