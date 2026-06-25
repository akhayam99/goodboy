export const m033WorkspaceInitScripts = /* sql */ `
CREATE TABLE workspace_init_scripts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_wis_workspace_latest ON workspace_init_scripts(workspace_id, created_at DESC);

ALTER TABLE sessions ADD COLUMN skip_init INTEGER NOT NULL DEFAULT 0 CHECK (skip_init IN (0, 1));
`
