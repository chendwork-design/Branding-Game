-- Report engagement is append-compatible metadata; it never changes report facts.
ALTER TABLE playthroughs ADD COLUMN IF NOT EXISTS report_viewed_at TIMESTAMPTZ;
ALTER TABLE playthroughs ADD COLUMN IF NOT EXISTS report_read_depth INTEGER NOT NULL DEFAULT 0 CHECK (report_read_depth >= 0 AND report_read_depth <= 100);
