export const m121ProjectSessionMounts = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS session_worktrees_new;

CREATE TABLE session_worktrees_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  branch TEXT NOT NULL,
  parallel_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  project_id TEXT,
  mount_name TEXT,
  repo_slug TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

INSERT INTO session_worktrees_new (
  id,
  session_id,
  worktree_path,
  branch,
  parallel_index,
  created_at,
  project_id,
  mount_name,
  repo_slug
)
SELECT
  id,
  session_id,
  worktree_path,
  branch,
  parallel_index,
  created_at,
  mount_workspace_id,
  mount_name,
  repo_slug
FROM session_worktrees;

DROP TABLE session_worktrees;
ALTER TABLE session_worktrees_new RENAME TO session_worktrees;

DROP INDEX IF EXISTS idx_session_worktrees_session_id;
CREATE INDEX idx_session_worktrees_session_id ON session_worktrees(session_id);
DROP INDEX IF EXISTS idx_session_worktrees_path;
CREATE UNIQUE INDEX idx_session_worktrees_path ON session_worktrees(worktree_path);
DROP INDEX IF EXISTS idx_session_worktrees_repo_slug_branch;
CREATE INDEX idx_session_worktrees_repo_slug_branch ON session_worktrees(repo_slug, branch);
CREATE INDEX idx_session_worktrees_project_id ON session_worktrees(project_id);

DROP TABLE IF EXISTS session_external_tasks_new;

CREATE TABLE session_external_tasks_new (
  session_id TEXT NOT NULL,
  project_id TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'github', 'jira', 'bitbucket', 'slack')),
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  branch TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO session_external_tasks_new (
  session_id,
  project_id,
  provider,
  external_id,
  identifier,
  url,
  title,
  created_at,
  branch
)
SELECT
  session_id,
  mount_workspace_id,
  provider,
  external_id,
  identifier,
  url,
  title,
  created_at,
  branch
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
    COALESCE(project_id, '')
  );

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
