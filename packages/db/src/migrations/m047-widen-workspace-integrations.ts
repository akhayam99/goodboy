/**
 * m047 — widen workspace_integrations provider CHECK to include 'jira'.
 *
 * SQLite cannot ALTER a CHECK constraint in place, so we rebuild the table:
 * create a temp table with the wider constraint, copy rows, drop the old
 * table, rename. Existing Linear rows survive unchanged.
 */
export const m047WidenWorkspaceIntegrations = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS workspace_integrations_new;
CREATE TABLE workspace_integrations_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'jira')),
  config TEXT NOT NULL DEFAULT '{}',
  credential_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (workspace_id, provider),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
INSERT INTO workspace_integrations_new SELECT * FROM workspace_integrations;
DROP TABLE workspace_integrations;
ALTER TABLE workspace_integrations_new RENAME TO workspace_integrations;
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_workspace_id ON workspace_integrations(workspace_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
