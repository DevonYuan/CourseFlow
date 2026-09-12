-- Migration v5: Create pages table for standalone Notes workspace
-- Date: 2026-09-12
-- Phase 3: Pages table with hierarchical nesting.
--
-- IMPORTANT: This migration intentionally does NOT create an FTS5 virtual
-- table. The app runs on sql.js (WASM), whose bundled SQLite build does not
-- compile in the `fts5` module — `CREATE VIRTUAL TABLE ... USING fts5(...)`
-- fails at startup with "no such module: fts5" and blocks the whole app.
-- Full-text search is instead implemented as a LIKE query over `pages` in
-- the repository (`repo.searchPages`), which needs no extra modules.
-- If FTS5 is ever required, ship a custom sql.js build with FTS5 enabled.

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  icon TEXT,
  cover TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id, position);
CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updated_at DESC);
