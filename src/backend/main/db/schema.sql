-- Schema v1 for CourseFlow
-- This file is a reference; the actual migration is embedded in migrate.ts

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
  workflow_state TEXT,                    -- 'published', 'unpublished', etc.
  html_url TEXT,                          -- Canvas URL
  ical_uid TEXT UNIQUE,                   -- iCal UID for dedup across syncs
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  source TEXT CHECK (source IN ('manual', 'ical')) DEFAULT 'manual',
  source_url TEXT,                        -- iCal feed URL this came from
  rrule TEXT,                             -- RRULE string for recurring
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
CREATE INDEX idx_assignments_ical_uid ON assignments(ical_uid);