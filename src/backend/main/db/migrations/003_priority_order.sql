-- Migration v3: Add created_at/updated_at to priority_order and index on position
-- Date: 2026-09-02
-- Note: schema_migrations entry is inserted by the migration runner (migrate.ts)
-- Note: runner wraps migration in transaction (BEGIN/COMMIT)

-- Add created_at and updated_at columns to priority_order table
-- Using ALTER TABLE since table was created in v1
ALTER TABLE priority_order ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE priority_order ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

-- Create index on position for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_priority_order_position ON priority_order(position);