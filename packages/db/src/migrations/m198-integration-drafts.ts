export const m198IntegrationDrafts = `
CREATE TABLE integration_drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  verb TEXT NOT NULL,
  target_json TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'discarded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  decided_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_integration_drafts_workspace_id
  ON integration_drafts(workspace_id);
CREATE INDEX idx_integration_drafts_session_status
  ON integration_drafts(session_id, status, created_at);
`;
