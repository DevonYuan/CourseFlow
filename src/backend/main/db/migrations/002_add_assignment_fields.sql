-- Migration v2: Add missing Assignment and Settings columns
-- Assignments table additions
ALTER TABLE assignments ADD COLUMN status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')) DEFAULT 'pending';
ALTER TABLE assignments ADD COLUMN source TEXT CHECK (source IN ('manual', 'ical')) DEFAULT 'manual';
ALTER TABLE assignments ADD COLUMN source_url TEXT;
ALTER TABLE assignments ADD COLUMN rrule TEXT;

-- Backfill status for existing rows
UPDATE assignments SET status = 'pending' WHERE status IS NULL;
UPDATE assignments SET source = 'manual' WHERE source IS NULL;

-- Add index for ical_uid lookups (redundant with UNIQUE constraint but explicit for clarity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_ical_uid ON assignments(ical_uid);

-- Settings table additions
ALTER TABLE settings ADD COLUMN ical_url TEXT;
ALTER TABLE settings ADD COLUMN last_sync_at TEXT;