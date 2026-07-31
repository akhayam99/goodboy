export const m092WorkflowNameUniqueLive = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS workflows_new;
CREATE TABLE workflows_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  is_preset INTEGER NOT NULL DEFAULT 1,
  goal TEXT,
  process_text TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO workflows_new
  (id, workspace_id, name, description, created_at, updated_at, deleted_at, is_preset, goal, process_text)
SELECT
  id, workspace_id, name, description, created_at, updated_at, deleted_at, is_preset, goal, process_text
FROM workflows;

DROP TABLE workflows;
ALTER TABLE workflows_new RENAME TO workflows;

CREATE UNIQUE INDEX idx_workflows_workspace_name_live
  ON workflows(workspace_id, name)
  WHERE deleted_at IS NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
