-- Migration v6: Calendar Sources (Multi-Calendar Support)
-- Date: 2026-09-15
-- Phase 4: Add calendars table and source_id FK to assignments

-- Calendar sources table
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,          -- encrypted JSON envelope
  enabled INTEGER NOT NULL DEFAULT 1,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  last_sync_at INTEGER,
  next_sync_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Add source_id to assignments (nullable for backward compat during migration)
ALTER TABLE assignments ADD COLUMN source_id TEXT REFERENCES calendars(id);

-- Index for per-source dedupe: (source_id, ical_uid)
CREATE INDEX IF NOT EXISTS idx_assignments_source_ical ON assignments(source_id, ical_uid);

-- Seed initial calendar from settings.icalUrl (handled in migration runner JS)