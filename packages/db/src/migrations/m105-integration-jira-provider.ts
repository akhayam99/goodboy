export const m105IntegrationJiraProvider = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS workspace_integrations_new;

CREATE TABLE workspace_integrations_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'jira')),
  config TEXT NOT NULL DEFAULT '{}',
  credential_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (workspace_id, provider),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO workspace_integrations_new (id, workspace_id, provider, config, credential_key, created_at, updated_at)
  SELECT id, workspace_id, provider, config, credential_key, created_at, updated_at
  FROM workspace_integrations;

DROP TABLE workspace_integrations;
ALTER TABLE workspace_integrations_new RENAME TO workspace_integrations;

DROP INDEX IF EXISTS idx_workspace_integrations_workspace_id;
CREATE INDEX idx_workspace_integrations_workspace_id ON workspace_integrations(workspace_id);

DROP TABLE IF EXISTS session_external_tasks_new;

CREATE TABLE session_external_tasks_new (
  session_id TEXT NOT NULL,
  mount_workspace_id TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'github', 'jira')),
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  branch TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO session_external_tasks_new
  (session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at, branch)
  SELECT session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at, branch
  FROM session_external_tasks;

DROP TABLE session_external_tasks;
ALTER TABLE session_external_tasks_new RENAME TO session_external_tasks;

DROP INDEX IF EXISTS idx_session_external_tasks_provider_external;
CREATE INDEX idx_session_external_tasks_provider_external
  ON session_external_tasks(provider, external_id);
DROP INDEX IF EXISTS idx_session_external_tasks_identity;
CREATE UNIQUE INDEX idx_session_external_tasks_identity
  ON session_external_tasks(
    session_id,
    provider,
    external_id,
    COALESCE(mount_workspace_id, '')
  );

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
