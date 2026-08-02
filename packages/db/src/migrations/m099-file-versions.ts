export const m099FileVersions = /* sql */ `
CREATE TABLE file_versions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  change_kind TEXT NOT NULL CHECK (change_kind IN ('modified', 'deleted')),
  snapshot_source TEXT NOT NULL CHECK (snapshot_source IN ('agent_turn', 'restore')),
  provider_run_id TEXT,
  captured_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_versions_session_path_captured
  ON file_versions(session_id, relative_path, captured_at DESC);
`;
