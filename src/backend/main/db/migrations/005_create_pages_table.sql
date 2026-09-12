-- Migration v5: Create pages table for standalone Notes workspace
-- Date: 2026-09-12
-- Phase 3: Pages table with hierarchical nesting, FTS5 search, and triggers

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

-- FTS5 virtual table for full-text search
-- Uses content='pages' for automatic sync with the pages table
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  content='pages',
  content_rowid='rowid'
);

-- Triggers to keep FTS5 in sync with pages table
-- INSERT trigger
CREATE TRIGGER IF NOT EXISTS pages_fts_insert AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts (rowid, id, title, content)
  VALUES (new.rowid, new.id, new.title, new.content);
END;

-- UPDATE trigger
CREATE TRIGGER IF NOT EXISTS pages_fts_update AFTER UPDATE ON pages BEGIN
  UPDATE pages_fts
  SET title = new.title,
      content = new.content
  WHERE rowid = old.rowid;
END;

-- DELETE trigger
CREATE TRIGGER IF NOT EXISTS pages_fts_delete AFTER DELETE ON pages BEGIN
  DELETE FROM pages_fts WHERE rowid = old.rowid;
END;