export const m125NormalizeTimestamps = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS workflows_new;

CREATE TABLE workflows_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  is_preset INTEGER NOT NULL DEFAULT 1,
  goal TEXT,
  process_text TEXT,
  origin TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO workflows_new (
  id, workspace_id, name, description, created_at, updated_at, deleted_at,
  is_preset, goal, process_text, origin
)
SELECT
  id,
  workspace_id,
  name,
  description,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN typeof(updated_at) IN ('integer', 'real')
      THEN CASE WHEN updated_at < 100000000000 THEN CAST(updated_at * 1000 AS INTEGER) ELSE CAST(updated_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(updated_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN deleted_at IS NULL THEN NULL
    WHEN deleted_at < 100000000000 THEN CAST(deleted_at * 1000 AS INTEGER)
    ELSE CAST(deleted_at AS INTEGER)
  END,
  is_preset,
  goal,
  process_text,
  origin
FROM workflows;

DROP TABLE workflows;
ALTER TABLE workflows_new RENAME TO workflows;

DROP INDEX IF EXISTS idx_workflows_workspace_name_live;
CREATE UNIQUE INDEX idx_workflows_workspace_name_live
  ON workflows(workspace_id, name)
  WHERE deleted_at IS NULL;

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
  id, workflow_id, library_step_id, ordinal, name, prompt_prefix, provider_override,
  model_override, effort, verbosity, deleted_at, role, expected_output, orchestrator_reason
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
  CASE
    WHEN deleted_at IS NULL THEN NULL
    WHEN deleted_at < 100000000000 THEN CAST(deleted_at * 1000 AS INTEGER)
    ELSE CAST(deleted_at AS INTEGER)
  END,
  role,
  expected_output,
  orchestrator_reason
FROM steps;

DROP TABLE steps;
ALTER TABLE steps_new RENAME TO steps;

DROP INDEX IF EXISTS idx_steps_workflow_id;
CREATE INDEX idx_steps_workflow_id ON steps(workflow_id);

DROP TABLE IF EXISTS step_library_new;

CREATE TABLE step_library_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  role TEXT NOT NULL DEFAULT 'custom',
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_default TEXT,
  model_default TEXT,
  effort_default TEXT,
  verbosity_default TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO step_library_new (
  id, workspace_id, role, name, prompt_prefix, provider_default, model_default,
  effort_default, verbosity_default, created_at, updated_at, deleted_at
)
SELECT
  id,
  workspace_id,
  role,
  name,
  prompt_prefix,
  provider_default,
  model_default,
  effort_default,
  verbosity_default,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN typeof(updated_at) IN ('integer', 'real')
      THEN CASE WHEN updated_at < 100000000000 THEN CAST(updated_at * 1000 AS INTEGER) ELSE CAST(updated_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(updated_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN deleted_at IS NULL THEN NULL
    WHEN deleted_at < 100000000000 THEN CAST(deleted_at * 1000 AS INTEGER)
    ELSE CAST(deleted_at AS INTEGER)
  END
FROM step_library;

DROP TABLE step_library;
ALTER TABLE step_library_new RENAME TO step_library;

DROP INDEX IF EXISTS idx_step_library_workspace;
CREATE INDEX idx_step_library_workspace ON step_library(workspace_id);

DROP TABLE IF EXISTS session_workflows_new;

CREATE TABLE session_workflows_new (
  workflow_run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  current_step_ordinal INTEGER NOT NULL DEFAULT 0,
  auto_run INTEGER NOT NULL DEFAULT 0,
  discarded_at INTEGER,
  created_at INTEGER NOT NULL,
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
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (chain_after_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

INSERT INTO session_workflows_new (
  workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run,
  discarded_at, created_at, goal, trigger_mode, chain_after_run_id, execution_mode,
  orchestration_outcome, orchestration_error, orchestrator_hints, orchestration_reason,
  orchestrator_provider, orchestrator_model, orchestrator_effort, orchestration_stop_kind,
  orchestrator_summary, spend_limit_usd, spend_limit_mode, role_model_overrides
)
SELECT
  workflow_run_id,
  session_id,
  workflow_id,
  ordinal,
  current_step_ordinal,
  auto_run,
  CASE
    WHEN discarded_at IS NULL THEN NULL
    WHEN typeof(discarded_at) IN ('integer', 'real')
      THEN CASE WHEN discarded_at < 100000000000 THEN CAST(discarded_at * 1000 AS INTEGER) ELSE CAST(discarded_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(discarded_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    WHEN julianday(created_at) IS NOT NULL
      THEN CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
    WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER)
    ELSE CAST(created_at AS INTEGER)
  END,
  goal,
  trigger_mode,
  CASE
    WHEN chain_after_run_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM session_workflows parent_run
        WHERE parent_run.workflow_run_id = session_workflows.chain_after_run_id
      )
      THEN chain_after_run_id
    ELSE NULL
  END,
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
CREATE INDEX idx_session_workflows_chain_after_run_id
  ON session_workflows(chain_after_run_id)
  WHERE chain_after_run_id IS NOT NULL;

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
  started_at INTEGER,
  provider_session_id TEXT,
  last_finished_at INTEGER,
  last_viewed_at INTEGER,
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
  done_at INTEGER,
  source_thread_ids TEXT,
  domains_json TEXT,
  provider_session_provider_id TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

INSERT INTO agents_new (
  id, session_id, step_id, ordinal, name, status, provider_run_id, output_summary,
  started_at, provider_session_id, last_finished_at, last_viewed_at, deleted_at,
  verbosity, effort, model_override, provider_override, kind, parent_agent_id,
  workflow_run_id, source_thread_id, source_comment_url, source_kind, done_at,
  source_thread_ids, domains_json, provider_session_provider_id
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
  CASE
    WHEN started_at IS NULL THEN NULL
    WHEN typeof(started_at) IN ('integer', 'real')
      THEN CASE WHEN started_at < 100000000000 THEN CAST(started_at * 1000 AS INTEGER) ELSE CAST(started_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(started_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  provider_session_id,
  CASE
    WHEN last_finished_at IS NULL THEN NULL
    WHEN typeof(last_finished_at) IN ('integer', 'real')
      THEN CASE WHEN last_finished_at < 100000000000 THEN CAST(last_finished_at * 1000 AS INTEGER) ELSE CAST(last_finished_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(last_finished_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN last_viewed_at IS NULL THEN NULL
    WHEN typeof(last_viewed_at) IN ('integer', 'real')
      THEN CASE WHEN last_viewed_at < 100000000000 THEN CAST(last_viewed_at * 1000 AS INTEGER) ELSE CAST(last_viewed_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(last_viewed_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  deleted_at,
  verbosity,
  effort,
  model_override,
  provider_override,
  kind,
  parent_agent_id,
  CASE
    WHEN workflow_run_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM session_workflows
        WHERE session_workflows.workflow_run_id = agents.workflow_run_id
      )
      THEN workflow_run_id
    ELSE NULL
  END,
  source_thread_id,
  source_comment_url,
  source_kind,
  CASE
    WHEN done_at IS NULL THEN NULL
    WHEN typeof(done_at) IN ('integer', 'real')
      THEN CASE WHEN done_at < 100000000000 THEN CAST(done_at * 1000 AS INTEGER) ELSE CAST(done_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(done_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  source_thread_ids,
  domains_json,
  provider_session_provider_id
FROM agents;

DROP TABLE agents;
ALTER TABLE agents_new RENAME TO agents;

DROP INDEX IF EXISTS idx_agents_session_id;
CREATE INDEX idx_agents_session_id ON agents(session_id);
DROP INDEX IF EXISTS idx_agents_active;
CREATE INDEX idx_agents_active ON agents(session_id) WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS idx_agents_step_id;
CREATE INDEX idx_agents_step_id ON agents(step_id) WHERE step_id IS NOT NULL;
DROP INDEX IF EXISTS idx_agents_unread;
CREATE INDEX idx_agents_unread ON agents(session_id, last_finished_at DESC);
DROP INDEX IF EXISTS idx_agents_workflow_run_id;
CREATE INDEX idx_agents_workflow_run_id
  ON agents(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

DROP TABLE IF EXISTS budget_rules_new;

CREATE TABLE budget_rules_new (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly')),
  cap_usd REAL NOT NULL,
  alert_threshold_pct REAL NOT NULL DEFAULT 80,
  extra_tokens_budget INTEGER,
  created_at INTEGER NOT NULL
);

INSERT INTO budget_rules_new (
  id, provider, period, cap_usd, alert_threshold_pct, extra_tokens_budget, created_at
)
SELECT
  id,
  provider,
  period,
  cap_usd,
  alert_threshold_pct,
  extra_tokens_budget,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM budget_rules;

DROP TABLE budget_rules;
ALTER TABLE budget_rules_new RENAME TO budget_rules;

DROP INDEX IF EXISTS idx_budget_rules_provider;
CREATE INDEX idx_budget_rules_provider ON budget_rules(provider);

DROP TABLE IF EXISTS budget_alerts_new;

CREATE TABLE budget_alerts_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('provider-threshold','provider-exceeded','session-threshold','session-exceeded')),
  provider TEXT,
  session_id TEXT,
  current_usd REAL NOT NULL,
  cap_usd REAL NOT NULL,
  created_at INTEGER NOT NULL,
  dismissed_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO budget_alerts_new (
  id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at
)
SELECT
  id,
  kind,
  provider,
  session_id,
  current_usd,
  cap_usd,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN dismissed_at IS NULL THEN NULL
    WHEN typeof(dismissed_at) IN ('integer', 'real')
      THEN CASE WHEN dismissed_at < 100000000000 THEN CAST(dismissed_at * 1000 AS INTEGER) ELSE CAST(dismissed_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(dismissed_at) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM budget_alerts;

DROP TABLE budget_alerts;
ALTER TABLE budget_alerts_new RENAME TO budget_alerts;

DROP INDEX IF EXISTS idx_budget_alerts_active;
CREATE INDEX idx_budget_alerts_active
  ON budget_alerts(created_at DESC)
  WHERE dismissed_at IS NULL;
DROP INDEX IF EXISTS idx_budget_alerts_provider;
CREATE INDEX idx_budget_alerts_provider ON budget_alerts(provider);
DROP INDEX IF EXISTS idx_budget_alerts_session_id;
CREATE INDEX idx_budget_alerts_session_id ON budget_alerts(session_id);

DROP TABLE IF EXISTS github_pr_cache_new;

CREATE TABLE github_pr_cache_new (
  branch TEXT NOT NULL,
  repo_slug TEXT NOT NULL,
  pr_json TEXT,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (repo_slug, branch)
);

INSERT INTO github_pr_cache_new (branch, repo_slug, pr_json, fetched_at)
SELECT
  branch,
  repo_slug,
  pr_json,
  CASE
    WHEN typeof(fetched_at) IN ('integer', 'real')
      THEN CASE WHEN fetched_at < 100000000000 THEN CAST(fetched_at * 1000 AS INTEGER) ELSE CAST(fetched_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(fetched_at) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM github_pr_cache;

DROP TABLE github_pr_cache;
ALTER TABLE github_pr_cache_new RENAME TO github_pr_cache;

DROP INDEX IF EXISTS idx_github_pr_cache_branch;
CREATE INDEX idx_github_pr_cache_branch ON github_pr_cache(branch);

DROP TABLE IF EXISTS notifications_new;

CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY NOT NULL,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  session_id TEXT,
  workspace_id TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  action TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

INSERT INTO notifications_new (
  id, ts, kind, title, body, severity, session_id, workspace_id, read, action
)
SELECT
  id,
  CASE
    WHEN typeof(ts) IN ('integer', 'real')
      THEN CASE WHEN ts < 100000000000 THEN CAST(ts * 1000 AS INTEGER) ELSE CAST(ts AS INTEGER) END
    ELSE CAST(ROUND((julianday(ts) - 2440587.5) * 86400000) AS INTEGER)
  END,
  kind,
  title,
  body,
  severity,
  session_id,
  workspace_id,
  read,
  action
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

DROP INDEX IF EXISTS idx_notifications_session_id;
CREATE INDEX idx_notifications_session_id
  ON notifications(session_id)
  WHERE session_id IS NOT NULL;
DROP INDEX IF EXISTS idx_notifications_unread;
CREATE INDEX idx_notifications_unread
  ON notifications(ts DESC)
  WHERE read = 0;
DROP INDEX IF EXISTS idx_notifications_workspace_id;
CREATE INDEX idx_notifications_workspace_id
  ON notifications(workspace_id)
  WHERE workspace_id IS NOT NULL;

DROP TABLE IF EXISTS nudge_events_new;

CREATE TABLE nudge_events_new (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  context_json TEXT,
  outcome TEXT,
  outcome_ts INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO nudge_events_new (
  id, session_id, created_at, kind, context_json, outcome, outcome_ts
)
SELECT
  id,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM sessions
      WHERE sessions.id = json_extract(nudge_events.context_json, '$.sessionId')
    )
      THEN json_extract(context_json, '$.sessionId')
    ELSE NULL
  END,
  CASE
    WHEN typeof(ts) IN ('integer', 'real')
      THEN CASE WHEN ts < 100000000000 THEN CAST(ts * 1000 AS INTEGER) ELSE CAST(ts AS INTEGER) END
    ELSE CAST(ROUND((julianday(ts) - 2440587.5) * 86400000) AS INTEGER)
  END,
  kind,
  context_json,
  outcome,
  CASE
    WHEN outcome_ts IS NULL THEN NULL
    WHEN typeof(outcome_ts) IN ('integer', 'real')
      THEN CASE WHEN outcome_ts < 100000000000 THEN CAST(outcome_ts * 1000 AS INTEGER) ELSE CAST(outcome_ts AS INTEGER) END
    ELSE CAST(ROUND((julianday(outcome_ts) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM nudge_events;

DROP TABLE nudge_events;
ALTER TABLE nudge_events_new RENAME TO nudge_events;

DROP INDEX IF EXISTS idx_nudge_kind_ts;
CREATE INDEX idx_nudge_kind_created_at ON nudge_events(kind, created_at);
CREATE INDEX idx_nudge_session_id ON nudge_events(session_id);

DROP TABLE IF EXISTS permission_rules_new;

CREATE TABLE permission_rules_new (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('workspace','project','session','global')),
  workspace_id TEXT,
  project_id TEXT,
  session_id TEXT,
  pattern_tool TEXT NOT NULL,
  pattern_args_matcher TEXT,
  decision TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO permission_rules_new (
  id, scope, workspace_id, project_id, session_id, pattern_tool,
  pattern_args_matcher, decision, priority, created_at, updated_at
)
SELECT
  id,
  scope,
  workspace_id,
  project_id,
  session_id,
  pattern_tool,
  pattern_args_matcher,
  decision,
  priority,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN typeof(updated_at) IN ('integer', 'real')
      THEN CASE WHEN updated_at < 100000000000 THEN CAST(updated_at * 1000 AS INTEGER) ELSE CAST(updated_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(updated_at) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM permission_rules;

DROP TABLE permission_rules;
ALTER TABLE permission_rules_new RENAME TO permission_rules;

DROP INDEX IF EXISTS idx_permission_rules_project_id;
CREATE INDEX idx_permission_rules_project_id ON permission_rules(project_id);
DROP INDEX IF EXISTS idx_permission_rules_scope;
CREATE INDEX idx_permission_rules_scope ON permission_rules(scope);
DROP INDEX IF EXISTS idx_permission_rules_session_id;
CREATE INDEX idx_permission_rules_session_id ON permission_rules(session_id);
DROP INDEX IF EXISTS idx_permission_rules_workspace_id;
CREATE INDEX idx_permission_rules_workspace_id ON permission_rules(workspace_id);

DROP TABLE IF EXISTS permission_audit_log_new;

CREATE TABLE permission_audit_log_new (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool_use_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  rule_id TEXT,
  decided_by TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  decided_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES permission_rules(id) ON DELETE SET NULL
);

INSERT INTO permission_audit_log_new (
  id, run_id, session_id, tool_use_id, tool_name, input_json, decision,
  rule_id, decided_by, requested_at, decided_at
)
SELECT
  id,
  run_id,
  session_id,
  tool_use_id,
  tool_name,
  input_json,
  decision,
  rule_id,
  decided_by,
  CASE
    WHEN typeof(requested_at) IN ('integer', 'real')
      THEN CASE WHEN requested_at < 100000000000 THEN CAST(requested_at * 1000 AS INTEGER) ELSE CAST(requested_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(requested_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN typeof(decided_at) IN ('integer', 'real')
      THEN CASE WHEN decided_at < 100000000000 THEN CAST(decided_at * 1000 AS INTEGER) ELSE CAST(decided_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(decided_at) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM permission_audit_log;

DROP TABLE permission_audit_log;
ALTER TABLE permission_audit_log_new RENAME TO permission_audit_log;

DROP INDEX IF EXISTS idx_permission_audit_rule_id;
CREATE INDEX idx_permission_audit_rule_id ON permission_audit_log(rule_id);
DROP INDEX IF EXISTS idx_permission_audit_run_id;
CREATE INDEX idx_permission_audit_run_id ON permission_audit_log(run_id);
DROP INDEX IF EXISTS idx_permission_audit_session_id;
CREATE INDEX idx_permission_audit_session_id ON permission_audit_log(session_id);

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
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO pr_review_drafts_new (
  id, session_id, provider, repo, pr_number, path, line, start_line,
  side, body, status, origin, created_at
)
SELECT
  id,
  session_id,
  provider,
  repo,
  pr_number,
  path,
  line,
  start_line,
  side,
  body,
  status,
  origin,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM pr_review_drafts;

DROP TABLE pr_review_drafts;
ALTER TABLE pr_review_drafts_new RENAME TO pr_review_drafts;

DROP INDEX IF EXISTS idx_pr_review_drafts_session;
CREATE INDEX idx_pr_review_drafts_session ON pr_review_drafts(session_id);

DROP TABLE IF EXISTS skills_new;

CREATE TABLE skills_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, name)
);

INSERT INTO skills_new (
  id, workspace_id, name, description, file_path, body, frontmatter_json,
  created_at, updated_at
)
SELECT
  id,
  workspace_id,
  name,
  description,
  file_path,
  body,
  frontmatter_json,
  CASE
    WHEN typeof(created_at) IN ('integer', 'real')
      THEN CASE WHEN created_at < 100000000000 THEN CAST(created_at * 1000 AS INTEGER) ELSE CAST(created_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
  END,
  CASE
    WHEN typeof(updated_at) IN ('integer', 'real')
      THEN CASE WHEN updated_at < 100000000000 THEN CAST(updated_at * 1000 AS INTEGER) ELSE CAST(updated_at AS INTEGER) END
    ELSE CAST(ROUND((julianday(updated_at) - 2440587.5) * 86400000) AS INTEGER)
  END
FROM skills;

DROP TABLE skills;
ALTER TABLE skills_new RENAME TO skills;

DROP INDEX IF EXISTS idx_skills_workspace_id;
CREATE INDEX idx_skills_workspace_id ON skills(workspace_id);

UPDATE provider_runs
SET status_payload = json_set(
  status_payload,
  '$.startedAt',
  CASE
    WHEN typeof(json_extract(status_payload, '$.startedAt')) IN ('integer', 'real')
      THEN CASE
        WHEN json_extract(status_payload, '$.startedAt') < 100000000000
          THEN CAST(json_extract(status_payload, '$.startedAt') * 1000 AS INTEGER)
        ELSE CAST(json_extract(status_payload, '$.startedAt') AS INTEGER)
      END
    ELSE CAST(ROUND(
      (julianday(json_extract(status_payload, '$.startedAt')) - 2440587.5) * 86400000
    ) AS INTEGER)
  END
)
WHERE json_type(status_payload, '$.startedAt') IS NOT NULL;

UPDATE provider_runs
SET status_payload = json_set(
  status_payload,
  '$.finishedAt',
  CASE
    WHEN typeof(json_extract(status_payload, '$.finishedAt')) IN ('integer', 'real')
      THEN CASE
        WHEN json_extract(status_payload, '$.finishedAt') < 100000000000
          THEN CAST(json_extract(status_payload, '$.finishedAt') * 1000 AS INTEGER)
        ELSE CAST(json_extract(status_payload, '$.finishedAt') AS INTEGER)
      END
    ELSE CAST(ROUND(
      (julianday(json_extract(status_payload, '$.finishedAt')) - 2440587.5) * 86400000
    ) AS INTEGER)
  END
)
WHERE json_type(status_payload, '$.finishedAt') IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
