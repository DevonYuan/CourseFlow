-- Migration v1: Initial schema
-- Core assignments from iCal + user extensions
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  canvas_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  course_name TEXT NOT NULL,
  course_color TEXT,
  due_at INTEGER NOT NULL,
  unlock_at INTEGER,
  lock_at INTEGER,
  points_possible REAL,
  submission_types TEXT,
  workflow_state TEXT,
  html_url TEXT,
  ical_uid TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User-defined priority (drag-drop order)
CREATE TABLE IF NOT EXISTS priority_order (
  assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL UNIQUE
);

-- Sub-tasks / checklist per assignment
CREATE TABLE IF NOT EXISTS sub_tasks (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Notes per assignment
CREATE TABLE IF NOT EXISTS notes (
  assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

-- App settings (key-value, single row per key)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_due_at ON assignments(due_at);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_name);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_assignment ON sub_tasks(assignment_id, position);