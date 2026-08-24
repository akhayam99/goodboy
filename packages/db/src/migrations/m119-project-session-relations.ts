export const m119ProjectSessionRelations = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS projects_new;

CREATE TABLE projects_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  default_provider_id TEXT,
  default_workflow_id TEXT,
  default_branch_prefix TEXT,
  parallel_enabled INTEGER CHECK (parallel_enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  disconnected_at INTEGER,
  default_verbosity TEXT CHECK (default_verbosity IN ('brief', 'normal', 'verbose')),
  last_accessed_at INTEGER,
  provider_bindings TEXT,
  scout_fanout INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('repo', 'folder')),
  task_models TEXT,
  role_models TEXT,
  provider_pool TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO projects_new (
  id,
  workspace_id,
  name,
  root_path,
  default_provider_id,
  default_workflow_id,
  default_branch_prefix,
  parallel_enabled,
  created_at,
  updated_at,
  deleted_at,
  disconnected_at,
  default_verbosity,
  last_accessed_at,
  provider_bindings,
  scout_fanout,
  kind,
  task_models,
  role_models,
  provider_pool
)
SELECT
  id,
  workspace_id,
  name,
  root_path,
  default_provider_id,
  default_workflow_id,
  default_branch_prefix,
  parallel_enabled,
  created_at,
  updated_at,
  deleted_at,
  disconnected_at,
  default_verbosity,
  last_accessed_at,
  provider_bindings,
  scout_fanout,
  CASE kind WHEN 'simple' THEN 'folder' ELSE kind END,
  task_models,
  role_models,
  provider_pool
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

DROP INDEX IF EXISTS idx_projects_active;
CREATE INDEX idx_projects_active ON projects(disconnected_at);
DROP INDEX IF EXISTS idx_projects_last_accessed_at;
CREATE INDEX idx_projects_last_accessed_at ON projects(last_accessed_at);
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);

DROP TABLE IF EXISTS sessions_new;

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  state_kind TEXT NOT NULL CHECK (state_kind IN ('draft', 'starting', 'idle', 'running', 'error', 'ended')),
  state_payload TEXT NOT NULL DEFAULT '{}',
  provider_default TEXT NOT NULL DEFAULT 'anthropic',
  provider_allow_override INTEGER NOT NULL DEFAULT 1,
  workflow_id TEXT,
  current_step_ordinal INTEGER,
  default_provider_id TEXT,
  default_workflow_id TEXT,
  default_branch_prefix TEXT,
  parallel_enabled INTEGER CHECK (parallel_enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions',
  auto_run INTEGER NOT NULL DEFAULT 0,
  title_user_edited INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  deleted_at INTEGER,
  verbosity TEXT,
  effort TEXT,
  model_override TEXT,
  provider_override TEXT,
  user_status TEXT NOT NULL DEFAULT 'wip',
  skip_init INTEGER NOT NULL DEFAULT 0 CHECK (skip_init IN (0, 1)),
  provider_bindings TEXT,
  provider_enabled TEXT,
  active_project_id TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO sessions_new (
  id,
  workspace_id,
  goal,
  state_kind,
  state_payload,
  provider_default,
  provider_allow_override,
  workflow_id,
  current_step_ordinal,
  default_provider_id,
  default_workflow_id,
  default_branch_prefix,
  parallel_enabled,
  created_at,
  updated_at,
  permission_mode,
  auto_run,
  title_user_edited,
  archived_at,
  deleted_at,
  verbosity,
  effort,
  model_override,
  provider_override,
  user_status,
  skip_init,
  provider_bindings,
  provider_enabled,
  active_project_id
)
SELECT
  id,
  workspace_id,
  goal,
  state_kind,
  state_payload,
  provider_default,
  provider_allow_override,
  workflow_id,
  current_step_ordinal,
  default_provider_id,
  default_workflow_id,
  default_branch_prefix,
  parallel_enabled,
  created_at,
  updated_at,
  permission_mode,
  auto_run,
  title_user_edited,
  archived_at,
  deleted_at,
  verbosity,
  effort,
  model_override,
  provider_override,
  user_status,
  skip_init,
  provider_bindings,
  provider_enabled,
  active_mount_workspace_id
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

DROP INDEX IF EXISTS idx_sessions_workspace_id;
CREATE INDEX idx_sessions_workspace_id ON sessions(workspace_id);
DROP INDEX IF EXISTS idx_sessions_active;
CREATE INDEX idx_sessions_active
  ON sessions(workspace_id, updated_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
DROP INDEX IF EXISTS idx_sessions_archived;
CREATE INDEX idx_sessions_archived
  ON sessions(workspace_id, archived_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
