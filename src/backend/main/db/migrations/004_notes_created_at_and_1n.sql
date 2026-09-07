-- Migration v4: Add created_at to notes and convert to 1:N (multiple log entries per assignment)
-- Date: 2026-09-06
-- Phase 3: Notes should support multiple timestamped log entries per assignment (progress logging)

-- Step 1: Create new notes_1n table with proper 1:N schema
CREATE TABLE IF NOT EXISTS notes_1n (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Step 2: Migrate existing notes data (1:1 -> 1:N)
-- Each existing note becomes the first log entry
INSERT INTO notes_1n (id, assignment_id, content, created_at, updated_at)
SELECT 
  'note-' || assignment_id as id,
  assignment_id,
  content,
  updated_at as created_at,
  updated_at
FROM notes
WHERE content IS NOT NULL AND content != '';

-- Step 3: Drop old notes table and rename new one
DROP TABLE notes;
ALTER TABLE notes_1n RENAME TO notes;

-- Step 4: Create index for efficient querying by assignment
CREATE INDEX IF NOT EXISTS idx_notes_assignment ON notes(assignment_id, created_at DESC);

-- Step 5: Verify the migration
-- SELECT * FROM notes;