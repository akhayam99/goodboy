export const m245WorkEvents = `
CREATE TABLE work_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  mount_id TEXT,
  agent_id TEXT,
  kind TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  exit_code INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_work_events_mount ON work_events(mount_id, started_at);
CREATE INDEX idx_work_events_session ON work_events(session_id, started_at);
`;
