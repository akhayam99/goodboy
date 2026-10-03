export const m219SessionContextItems = `
CREATE TABLE session_context_items (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  topic TEXT,
  source_json TEXT,
  audience_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_session_context_items_session
  ON session_context_items(session_id, created_at);

CREATE INDEX idx_session_context_items_workspace
  ON session_context_items(workspace_id, kind, created_at);
`;
