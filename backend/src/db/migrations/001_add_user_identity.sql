-- Add user identity to sessions (run on existing DBs)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
