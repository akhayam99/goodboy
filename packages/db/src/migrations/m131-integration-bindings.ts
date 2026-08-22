export const m131IntegrationBindings = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS integration_credentials_new;

CREATE TABLE integration_credentials_new (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO integration_credentials_new (id, provider, label, account, created_at, updated_at)
  SELECT id, provider, label, account, created_at, updated_at FROM integration_credentials;

DROP TABLE integration_credentials;
ALTER TABLE integration_credentials_new RENAME TO integration_credentials;

DROP INDEX IF EXISTS idx_integration_credentials_provider;
CREATE INDEX idx_integration_credentials_provider ON integration_credentials(provider);

DROP TABLE IF EXISTS integration_bindings;

CREATE TABLE integration_bindings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  provider TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (credential_id) REFERENCES integration_credentials(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_integration_bindings_scope
  ON integration_bindings(workspace_id, COALESCE(project_id, ''), provider);
CREATE INDEX idx_integration_bindings_credential_id ON integration_bindings(credential_id);

INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
  SELECT
    wi.id,
    p.workspace_id,
    CASE WHEN wi.id = (
      SELECT lead.id
      FROM workspace_integrations lead
      JOIN projects lp ON lp.id = lead.workspace_id
      WHERE lp.workspace_id = p.workspace_id AND lead.provider = wi.provider
      ORDER BY lp.last_accessed_at DESC, lp.id ASC
      LIMIT 1
    ) THEN NULL ELSE p.id END,
    wi.provider,
    wi.credential_id,
    wi.config,
    wi.created_at,
    wi.updated_at
  FROM workspace_integrations wi
  JOIN projects p ON p.id = wi.workspace_id
  WHERE p.workspace_id IS NOT NULL;

DROP TABLE workspace_integrations;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
