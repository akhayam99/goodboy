export const m114IntegrationCredentials = /* sql */ `
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS integration_credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'jira', 'bitbucket', 'slack')),
  label TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_provider ON integration_credentials(provider);

INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
  SELECT
    wi.id,
    wi.provider,
    COALESCE(
      CASE wi.provider
        WHEN 'linear' THEN json_extract(wi.config, '$.viewerName')
        WHEN 'sentry' THEN COALESCE(json_extract(wi.config, '$.orgName'), json_extract(wi.config, '$.org'))
        WHEN 'gitlab' THEN json_extract(wi.config, '$.userName')
        WHEN 'jira' THEN COALESCE(json_extract(wi.config, '$.displayName'), json_extract(wi.config, '$.email'))
        WHEN 'bitbucket' THEN COALESCE(json_extract(wi.config, '$.displayName'), json_extract(wi.config, '$.email'))
        WHEN 'slack' THEN COALESCE(json_extract(wi.config, '$.botUserName'), json_extract(wi.config, '$.botUserId'))
      END,
      wi.provider
    ),
    COALESCE(
      CASE wi.provider
        WHEN 'linear' THEN 'linear.app/' || json_extract(wi.config, '$.workspaceUrlKey')
        WHEN 'sentry' THEN json_extract(wi.config, '$.org')
        WHEN 'gitlab' THEN json_extract(wi.config, '$.host')
        WHEN 'jira' THEN json_extract(wi.config, '$.siteUrl')
        WHEN 'bitbucket' THEN 'bitbucket.org/' || json_extract(wi.config, '$.workspaceSlug')
        WHEN 'slack' THEN json_extract(wi.config, '$.teamName')
      END,
      ''
    ),
    wi.created_at,
    wi.updated_at
  FROM workspace_integrations wi
  WHERE wi.id NOT IN (SELECT id FROM integration_credentials);

DROP TABLE IF EXISTS workspace_integrations_new;

CREATE TABLE workspace_integrations_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'jira', 'bitbucket', 'slack')),
  config TEXT NOT NULL DEFAULT '{}',
  credential_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (workspace_id, provider),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (credential_id) REFERENCES integration_credentials(id) ON DELETE RESTRICT
);

INSERT INTO workspace_integrations_new (id, workspace_id, provider, config, credential_id, created_at, updated_at)
  SELECT id, workspace_id, provider, config, id, created_at, updated_at
  FROM workspace_integrations;

DROP TABLE workspace_integrations;
ALTER TABLE workspace_integrations_new RENAME TO workspace_integrations;

DROP INDEX IF EXISTS idx_workspace_integrations_workspace_id;
CREATE INDEX idx_workspace_integrations_workspace_id ON workspace_integrations(workspace_id);
DROP INDEX IF EXISTS idx_workspace_integrations_credential_id;
CREATE INDEX idx_workspace_integrations_credential_id ON workspace_integrations(credential_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
