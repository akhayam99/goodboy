export const m039IdeasBacklog = /* sql */ `
CREATE TABLE ideas_backlog (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  rephrased_title TEXT,
  rephrased_body TEXT,
  suggested_workspace_id TEXT,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('raw', 'rephrased', 'spawned', 'failed')) DEFAULT 'raw',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (suggested_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);
CREATE INDEX idx_ideas_backlog_workspace ON ideas_backlog(workspace_id, status, created_at DESC);
`;
