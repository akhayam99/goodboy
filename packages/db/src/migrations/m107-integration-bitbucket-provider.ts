export const m107IntegrationBitbucketProvider = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS workspace_integrations_new;

CREATE TABLE workspace_integrations_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'jira', 'bitbucket')),
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
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'github', 'jira', 'bitbucket')),
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

DROP TABLE IF EXISTS pr_review_drafts_new;

CREATE TABLE pr_review_drafts_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  path TEXT NOT NULL,
  line INTEGER NOT NULL,
  start_line INTEGER,
  side TEXT NOT NULL DEFAULT 'new',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  origin TEXT NOT NULL DEFAULT 'agent',
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO pr_review_drafts_new
  (id, session_id, provider, repo, pr_number, path, line, start_line, side, body, status, origin, created_at)
  SELECT id, session_id, provider, repo, pr_number, path, line, start_line, side, body, status, origin, created_at
  FROM pr_review_drafts;

DROP TABLE pr_review_drafts;
ALTER TABLE pr_review_drafts_new RENAME TO pr_review_drafts;

DROP INDEX IF EXISTS idx_pr_review_drafts_session;
CREATE INDEX idx_pr_review_drafts_session
  ON pr_review_drafts(session_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
