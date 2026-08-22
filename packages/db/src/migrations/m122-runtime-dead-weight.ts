export const m122RuntimeDeadWeight = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS session_provider_enabled_backfill;

CREATE TABLE session_provider_enabled_backfill (
  session_id TEXT PRIMARY KEY,
  provider_enabled TEXT NOT NULL
);

WITH RECURSIVE provider_parts(session_id, provider, remainder) AS (
  SELECT id, '', COALESCE(provider_enabled, '') || ','
  FROM sessions
  WHERE provider_enabled IS NOT NULL
  UNION ALL
  SELECT
    session_id,
    trim(substr(remainder, 1, instr(remainder, ',') - 1)),
    substr(remainder, instr(remainder, ',') + 1)
  FROM provider_parts
  WHERE remainder <> ''
)
INSERT INTO session_provider_enabled_backfill (session_id, provider_enabled)
SELECT session_id, json_group_array(provider)
FROM provider_parts
WHERE provider <> ''
GROUP BY session_id;

DROP TABLE IF EXISTS sessions_new;

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  state_kind TEXT NOT NULL CHECK (state_kind IN ('draft', 'starting', 'idle', 'running', 'error', 'ended')),
  last_activity_at INTEGER,
  provider_default TEXT NOT NULL DEFAULT 'anthropic',
  provider_allow_override INTEGER NOT NULL DEFAULT 1,
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
  last_activity_at,
  provider_default,
  provider_allow_override,
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
  provider_bindings,
  provider_enabled,
  active_project_id
)
SELECT
  sessions.id,
  sessions.workspace_id,
  sessions.goal,
  sessions.state_kind,
  CASE
    WHEN json_valid(sessions.state_payload) = 0 THEN NULL
    WHEN json_type(sessions.state_payload, '$.lastActivityAt') IN ('integer', 'real')
      THEN CAST(json_extract(sessions.state_payload, '$.lastActivityAt') AS INTEGER)
    WHEN json_type(sessions.state_payload, '$.lastActivityAt') = 'text'
      THEN CAST(strftime('%s', json_extract(sessions.state_payload, '$.lastActivityAt')) AS INTEGER) * 1000
        + CAST(substr(strftime('%f', json_extract(sessions.state_payload, '$.lastActivityAt')), 4, 3) AS INTEGER)
    ELSE NULL
  END,
  sessions.provider_default,
  sessions.provider_allow_override,
  sessions.default_provider_id,
  sessions.default_workflow_id,
  sessions.default_branch_prefix,
  sessions.parallel_enabled,
  sessions.created_at,
  sessions.updated_at,
  sessions.permission_mode,
  sessions.auto_run,
  sessions.title_user_edited,
  sessions.archived_at,
  sessions.deleted_at,
  sessions.verbosity,
  sessions.effort,
  sessions.model_override,
  sessions.provider_override,
  sessions.provider_bindings,
  CASE
    WHEN sessions.provider_enabled IS NULL THEN NULL
    ELSE COALESCE(session_provider_enabled_backfill.provider_enabled, '[]')
  END,
  sessions.active_project_id
FROM sessions
LEFT JOIN session_provider_enabled_backfill
  ON session_provider_enabled_backfill.session_id = sessions.id;

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

DROP TABLE session_provider_enabled_backfill;

DROP TABLE IF EXISTS agents_new;

CREATE TABLE agents_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  step_id TEXT,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_run_id TEXT,
  output_summary TEXT,
  started_at TEXT,
  provider_session_id TEXT,
  last_finished_at TEXT,
  last_viewed_at TEXT,
  deleted_at INTEGER,
  verbosity TEXT,
  effort TEXT,
  model_override TEXT,
  provider_override TEXT,
  kind TEXT,
  parent_agent_id TEXT,
  workflow_run_id TEXT,
  source_thread_id TEXT,
  source_comment_url TEXT,
  source_kind TEXT,
  done_at TEXT,
  source_thread_ids TEXT,
  domains_json TEXT,
  provider_session_provider_id TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE SET NULL
);

INSERT INTO agents_new (
  id,
  session_id,
  step_id,
  ordinal,
  name,
  status,
  provider_run_id,
  output_summary,
  started_at,
  provider_session_id,
  last_finished_at,
  last_viewed_at,
  deleted_at,
  verbosity,
  effort,
  model_override,
  provider_override,
  kind,
  parent_agent_id,
  workflow_run_id,
  source_thread_id,
  source_comment_url,
  source_kind,
  done_at,
  source_thread_ids,
  domains_json,
  provider_session_provider_id
)
SELECT
  id,
  session_id,
  step_id,
  ordinal,
  name,
  status,
  provider_run_id,
  output_summary,
  started_at,
  provider_session_id,
  COALESCE(last_finished_at, completed_at),
  last_viewed_at,
  deleted_at,
  verbosity,
  effort,
  model_override,
  provider_override,
  kind,
  parent_agent_id,
  workflow_run_id,
  source_thread_id,
  source_comment_url,
  source_kind,
  done_at,
  source_thread_ids,
  domains_json,
  provider_session_provider_id
FROM agents;

DROP TABLE agents;
ALTER TABLE agents_new RENAME TO agents;

DROP INDEX IF EXISTS idx_agents_group;
DROP INDEX IF EXISTS idx_agents_session_id;
CREATE INDEX idx_agents_session_id ON agents(session_id);
DROP INDEX IF EXISTS idx_agents_step_id;
CREATE INDEX idx_agents_step_id ON agents(step_id) WHERE step_id IS NOT NULL;
DROP INDEX IF EXISTS idx_agents_active;
CREATE INDEX idx_agents_active ON agents(session_id) WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS idx_agents_unread;
CREATE INDEX idx_agents_unread ON agents(session_id, last_finished_at DESC);
DROP INDEX IF EXISTS idx_agents_workflow_run_id;
CREATE INDEX idx_agents_workflow_run_id
  ON agents(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

DROP TABLE IF EXISTS session_workflows_new;

CREATE TABLE session_workflows_new (
  workflow_run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  current_step_ordinal INTEGER NOT NULL DEFAULT 0,
  auto_run INTEGER NOT NULL DEFAULT 0,
  discarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  goal TEXT,
  trigger_mode TEXT NOT NULL DEFAULT 'immediate',
  chain_after_run_id TEXT,
  execution_mode TEXT NOT NULL DEFAULT 'static',
  orchestration_outcome TEXT,
  orchestration_error TEXT,
  orchestrator_hints TEXT,
  orchestration_reason TEXT,
  orchestrator_provider TEXT,
  orchestrator_model TEXT,
  orchestrator_effort TEXT,
  orchestration_stop_kind TEXT NOT NULL DEFAULT 'failure',
  orchestrator_summary TEXT,
  spend_limit_usd REAL,
  spend_limit_mode TEXT NOT NULL DEFAULT 'pause',
  role_model_overrides TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

INSERT INTO session_workflows_new (
  workflow_run_id,
  session_id,
  workflow_id,
  ordinal,
  current_step_ordinal,
  auto_run,
  discarded_at,
  created_at,
  goal,
  trigger_mode,
  chain_after_run_id,
  execution_mode,
  orchestration_outcome,
  orchestration_error,
  orchestrator_hints,
  orchestration_reason,
  orchestrator_provider,
  orchestrator_model,
  orchestrator_effort,
  orchestration_stop_kind,
  orchestrator_summary,
  spend_limit_usd,
  spend_limit_mode,
  role_model_overrides
)
SELECT
  workflow_run_id,
  session_id,
  workflow_id,
  ordinal,
  current_step_ordinal,
  auto_run,
  discarded_at,
  created_at,
  goal,
  trigger_mode,
  chain_after_run_id,
  execution_mode,
  orchestration_outcome,
  orchestration_error,
  orchestrator_hints,
  orchestration_reason,
  orchestrator_provider,
  orchestrator_model,
  orchestrator_effort,
  orchestration_stop_kind,
  orchestrator_summary,
  spend_limit_usd,
  spend_limit_mode,
  role_model_overrides
FROM session_workflows;

DROP TABLE session_workflows;
ALTER TABLE session_workflows_new RENAME TO session_workflows;

DROP INDEX IF EXISTS idx_session_workflows_session_id;
CREATE INDEX idx_session_workflows_session_id ON session_workflows(session_id, ordinal);
DROP INDEX IF EXISTS idx_session_workflows_workflow_id;
CREATE INDEX idx_session_workflows_workflow_id ON session_workflows(workflow_id);

DROP TABLE IF EXISTS steps_new;

CREATE TABLE steps_new (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  library_step_id TEXT,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_override TEXT,
  model_override TEXT,
  effort TEXT,
  verbosity TEXT,
  deleted_at INTEGER,
  role TEXT,
  expected_output TEXT,
  orchestrator_reason TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (library_step_id) REFERENCES step_library(id) ON DELETE SET NULL
);

INSERT INTO steps_new (
  id,
  workflow_id,
  library_step_id,
  ordinal,
  name,
  prompt_prefix,
  provider_override,
  model_override,
  effort,
  verbosity,
  deleted_at,
  role,
  expected_output,
  orchestrator_reason
)
SELECT
  id,
  workflow_id,
  library_step_id,
  ordinal,
  name,
  prompt_prefix,
  provider_override,
  model_override,
  effort,
  verbosity,
  deleted_at,
  role,
  expected_output,
  orchestrator_reason
FROM steps;

DROP TABLE steps;
ALTER TABLE steps_new RENAME TO steps;

DROP INDEX IF EXISTS idx_steps_workflow_id;
CREATE INDEX idx_steps_workflow_id ON steps(workflow_id);

DROP TABLE IF EXISTS parallel_groups;

DROP TABLE IF EXISTS messages_new;

CREATE TABLE messages_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

INSERT INTO messages_new (id, session_id, agent_id, role, content, created_at)
SELECT id, session_id, agent_id, role, content, created_at
FROM messages;

DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

DROP INDEX IF EXISTS idx_messages_session_created;
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);
DROP INDEX IF EXISTS idx_messages_agent_created;
CREATE INDEX idx_messages_agent_created ON messages(agent_id, created_at);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
