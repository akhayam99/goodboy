export const m014RenameDomain = /* sql */ `
DROP INDEX IF EXISTS idx_parallel_phase_groups_session;
DROP INDEX IF EXISTS idx_session_phase_runs_group;
DROP INDEX IF EXISTS idx_phase_runs_session_id;
DROP INDEX IF EXISTS idx_phase_definitions_template_id;
DROP INDEX IF EXISTS idx_phase_templates_workspace_id;
DROP INDEX IF EXISTS idx_session_worktrees_session_id;
DROP INDEX IF EXISTS idx_permission_audit_retry_created;
DROP INDEX IF EXISTS idx_permission_audit_run_id;
DROP INDEX IF EXISTS idx_permission_audit_session_id;
DROP INDEX IF EXISTS idx_permission_rules_session_id;
DROP INDEX IF EXISTS idx_permission_rules_workspace_id;
DROP INDEX IF EXISTS idx_permission_rules_scope;
DROP INDEX IF EXISTS idx_skills_workspace_id;
DROP INDEX IF EXISTS idx_budget_alerts_created_at;
DROP INDEX IF EXISTS idx_budget_alerts_provider;
DROP INDEX IF EXISTS idx_budget_alerts_session_id;
DROP INDEX IF EXISTS idx_budget_rules_provider;
DROP INDEX IF EXISTS idx_telemetry_session_kind;
DROP INDEX IF EXISTS idx_telemetry_session_id;
DROP INDEX IF EXISTS idx_telemetry_run_id;
DROP INDEX IF EXISTS idx_provider_runs_session_id;
DROP INDEX IF EXISTS idx_messages_session_created;
DROP INDEX IF EXISTS idx_messages_session_id;
DROP INDEX IF EXISTS idx_sessions_workspace_id;

DROP TABLE IF EXISTS parallel_phase_groups;
DROP TABLE IF EXISTS session_phase_runs;
DROP TABLE IF EXISTS phase_definitions;
DROP TABLE IF EXISTS phase_templates;
DROP TABLE IF EXISTS session_worktrees;
DROP TABLE IF EXISTS permission_audit_retry;
DROP TABLE IF EXISTS permission_audit_log;
DROP TABLE IF EXISTS permission_rules;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS budget_alerts;
DROP TABLE IF EXISTS session_budgets;
DROP TABLE IF EXISTS budget_rules;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS telemetry_records;
DROP TABLE IF EXISTS provider_runs;
DROP TABLE IF EXISTS context_slots;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS workspaces;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  default_provider_id TEXT,
  default_workflow_id TEXT,
  default_branch_prefix TEXT,
  parallel_enabled INTEGER CHECK (parallel_enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  state_kind TEXT NOT NULL CHECK (state_kind IN ('draft','starting','idle','running','error','ended')),
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
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_tasks_workspace_id ON tasks(workspace_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  provider_override_id TEXT,
  provider_override_model TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_task_id ON messages(task_id);
CREATE INDEX idx_messages_task_created ON messages(task_id, created_at);

CREATE TABLE context_slots (
  task_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  PRIMARY KEY (task_id, key),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE provider_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic','openai','cursor','codex')),
  model TEXT NOT NULL,
  status_kind TEXT NOT NULL CHECK (status_kind IN ('pending','streaming','succeeded','failed','cancelled')),
  status_payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_provider_runs_task_id ON provider_runs(task_id);

CREATE TABLE telemetry_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'turn' CHECK (kind IN ('turn','summarizer')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd REAL NOT NULL,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES provider_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_telemetry_run_id ON telemetry_records(run_id);
CREATE INDEX idx_telemetry_task_id ON telemetry_records(task_id);
CREATE INDEX idx_telemetry_task_kind ON telemetry_records(task_id, kind);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE budget_rules (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly')),
  cap_usd REAL NOT NULL,
  alert_threshold_pct REAL NOT NULL DEFAULT 80,
  extra_tokens_budget INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_budget_rules_provider ON budget_rules(provider);

CREATE TABLE task_budgets (
  task_id TEXT PRIMARY KEY,
  soft_cap_usd REAL NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE budget_alerts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('provider-threshold','provider-exceeded','task-threshold','task-exceeded')),
  provider TEXT,
  task_id TEXT,
  current_usd REAL NOT NULL,
  cap_usd REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_budget_alerts_task_id ON budget_alerts(task_id);
CREATE INDEX idx_budget_alerts_provider ON budget_alerts(provider);
CREATE INDEX idx_budget_alerts_created_at ON budget_alerts(created_at);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, name)
);
CREATE INDEX idx_skills_workspace_id ON skills(workspace_id);

CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, name)
);
CREATE INDEX idx_workflows_workspace_id ON workflows(workspace_id);

CREATE TABLE steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_override TEXT,
  model_override TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE(workflow_id, ordinal)
);
CREATE INDEX idx_steps_workflow_id ON steps(workflow_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_run_id TEXT,
  output_summary TEXT,
  group_id TEXT,
  parallel_index INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_task_id ON sessions(task_id);
CREATE INDEX idx_sessions_group ON sessions(group_id);

CREATE TABLE permission_rules (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('workspace','task','global')),
  workspace_id TEXT,
  task_id TEXT,
  pattern_tool TEXT NOT NULL,
  pattern_args_matcher TEXT,
  decision TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_permission_rules_scope ON permission_rules(scope);
CREATE INDEX idx_permission_rules_workspace_id ON permission_rules(workspace_id);
CREATE INDEX idx_permission_rules_task_id ON permission_rules(task_id);

CREATE TABLE permission_audit_log (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  tool_use_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  rule_id TEXT,
  decided_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES permission_rules(id) ON DELETE SET NULL
);
CREATE INDEX idx_permission_audit_task_id ON permission_audit_log(task_id);
CREATE INDEX idx_permission_audit_run_id ON permission_audit_log(run_id);

CREATE TABLE permission_audit_retry (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_permission_audit_retry_created ON permission_audit_retry(created_at);

CREATE TABLE task_worktrees (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  branch TEXT NOT NULL,
  parallel_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_worktrees_task_id ON task_worktrees(task_id);

CREATE TABLE parallel_groups (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  merge_strategy TEXT NOT NULL CHECK (merge_strategy IN ('last_write_wins', 'manual', 'synthesizer_driven')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_parallel_groups_task ON parallel_groups(task_id);
`
