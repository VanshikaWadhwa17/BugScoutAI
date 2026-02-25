-- Run this on an existing DB to add new columns and constraints without dropping data.
-- For new installs, use db:setup which applies schema.sql from scratch.

-- Sessions: add summary columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS click_count INT DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS page_view_count INT DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS issue_count INT DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS first_event_at TIMESTAMP;

-- Events: add event_id for idempotency (backfill then add unique)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_id VARCHAR(64);
-- Backfill event_id for existing rows (use id so each row is unique)
UPDATE events SET event_id = encode(sha256((id::text)::bytea), 'hex')
WHERE event_id IS NULL;
ALTER TABLE events ALTER COLUMN event_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_project_event_id ON events(project_id, event_id);

-- Sessions: user identity (for filtering and support)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Issues: add severity and grouping columns
ALTER TABLE issues ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'low';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS occurrence_count INT DEFAULT 1;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
