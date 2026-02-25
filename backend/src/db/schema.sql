-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_event_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  click_count INT DEFAULT 0,
  page_view_count INT DEFAULT 0,
  issue_count INT DEFAULT 0,
  first_event_at TIMESTAMP,
  user_id VARCHAR(255),
  user_email VARCHAR(255)
);

-- Events table (event_id for idempotent ingest)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  event_id VARCHAR(64) NOT NULL,
  type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, event_id)
);

-- Issues table (grouping: occurrence_count, first_seen_at, last_seen_at; severity)
CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  issue_type VARCHAR(50) NOT NULL,
  element TEXT,
  severity VARCHAR(20) DEFAULT 'low',
  occurrence_count INT DEFAULT 1,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, session_id, issue_type, element)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(project_id, event_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_event_at ON sessions(last_event_at);
CREATE INDEX IF NOT EXISTS idx_issues_session_id ON issues(session_id);
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
