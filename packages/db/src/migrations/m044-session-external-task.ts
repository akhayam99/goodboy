export const m044SessionExternalTask = /* sql */ `
CREATE TABLE IF NOT EXISTS session_external_tasks (
  session_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('linear')),
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_external_tasks_provider_external
  ON session_external_tasks(provider, external_id);
`;
