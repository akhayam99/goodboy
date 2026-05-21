export const m036WorkspaceScripts = /* sql */ `
CREATE TABLE workspace_scripts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_workspace_scripts_workspace ON workspace_scripts(workspace_id, sort_order);

DROP TABLE IF EXISTS workspace_init_scripts;

UPDATE agents SET kind = 'generic' WHERE kind = 'init';
`;
