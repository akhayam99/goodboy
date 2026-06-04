export const m052PendingResolutions = /* sql */ `
CREATE TABLE IF NOT EXISTS pending_resolutions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  thread_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, thread_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_resolutions_session
  ON pending_resolutions(session_id);
`;
