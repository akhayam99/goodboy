/**
 * m031 - consolidated refactor:
 *   A) Rename DB tables to match UI nomenclature:
 *        tasks            -> sessions       (top-level entity)
 *        sessions         -> agents         (AI runner inside a session)
 *        task_budgets     -> session_budgets
 *        task_worktrees   -> session_worktrees
 *      Plus rename column task_id -> session_id everywhere.
 *      Plus rewrite CHECK constraints that mention the old domain
 *      ('task' scope, 'task-*' alert kinds) + migrate row data.
 *
 *   B) Soft-delete + archive in DB (replaces in-app/LS state):
 *        sessions.archived_at, sessions.deleted_at
 *        agents.deleted_at
 *        workspaces.deleted_at, workflows.deleted_at, steps.deleted_at,
 *        skills.deleted_at, permission_rules.deleted_at
 *        diff_comments.status += 'deleted'
 *
 *   C) Persistence sweep for per-entity exec config (today in LS / zustand):
 *        sessions: verbosity, effort, model_override, provider_override
 *        agents:   verbosity, effort, model_override, provider_override, kind
 *
 *   Bonus:
 *     - Drop redundant indices (prefix-covered by composite/UNIQUE).
 *     - Add missing FK indices (agents.step_id, permission_audit_log.rule_id,
 *       session_plans.agent_id).
 *     - Partial indices for soft-delete / archive listings.
 *     - UNIQUE on session_worktrees.worktree_path.
 *     - FK + indices on notifications (was bare table).
 *
 * Strategy:
 *   - Keep PRAGMA foreign_keys = ON during PHASE 1 renames so SQLite
 *     auto-rewrites FK target table names in referencing tables.
 *     (Per SQLite docs: FK propagation on RENAME only happens when
 *     foreign_keys pragma is enabled.)
 *   - Switch to PRAGMA foreign_keys = OFF only for PHASE 4 table rebuilds
 *     (DROP TABLE with referencing children would fail otherwise).
 *   - Back to ON at the end, plus foreign_key_check assertion.
 *   - Rename order: sessions->agents FIRST (frees old name), tasks->sessions
 *     SECOND. SQLite (legacy_alter_table OFF, default since 3.26) auto-updates
 *     FK target table names inside referencing tables when FK pragma is ON.
 *   - Table rebuilds use the *_new pattern with INSERT-SELECT, mirroring
 *     m014/m015/m028.
 */
export const m031RenameSoftDeletePersist = /* sql */ `
-- FK pragma must be ON for ALTER TABLE RENAME to propagate FK targets
-- in child tables. Default is OFF per connection, so set it explicitly.
PRAGMA foreign_keys = ON;

-- ============================================================
-- PHASE 1: Rename top-level tables (order matters)
-- FK pragma stays ON so SQLite rewrites FK targets in child tables.
-- ============================================================

ALTER TABLE sessions RENAME TO agents;
ALTER TABLE tasks RENAME TO sessions;
ALTER TABLE task_budgets RENAME TO session_budgets;
ALTER TABLE task_worktrees RENAME TO session_worktrees;

-- ============================================================
-- PHASE 2: Rename FK columns task_id -> session_id
-- (notifications.session_id is already correctly named - refers
-- to the top-level entity which we just renamed to sessions.)
-- ============================================================

ALTER TABLE messages              RENAME COLUMN task_id TO session_id;
ALTER TABLE context_slots         RENAME COLUMN task_id TO session_id;
ALTER TABLE provider_runs         RENAME COLUMN task_id TO session_id;
ALTER TABLE telemetry_records     RENAME COLUMN task_id TO session_id;
ALTER TABLE session_budgets       RENAME COLUMN task_id TO session_id;
ALTER TABLE agents                RENAME COLUMN task_id TO session_id;
ALTER TABLE session_worktrees     RENAME COLUMN task_id TO session_id;
ALTER TABLE parallel_groups       RENAME COLUMN task_id TO session_id;
ALTER TABLE turn_events           RENAME COLUMN task_id TO session_id;
ALTER TABLE context_slot_history  RENAME COLUMN task_id TO session_id;
-- permission_rules.task_id, permission_audit_log.task_id, diff_comments.task_id,
-- budget_alerts.task_id are handled in PHASE 4 (full rebuild for CHECK changes).

-- ============================================================
-- PHASE 3: Add new columns (soft-delete, archive, persistence)
-- ============================================================

-- sessions (ex-tasks)
ALTER TABLE sessions ADD COLUMN archived_at INTEGER;
ALTER TABLE sessions ADD COLUMN deleted_at INTEGER;
ALTER TABLE sessions ADD COLUMN verbosity TEXT;
ALTER TABLE sessions ADD COLUMN effort TEXT;
ALTER TABLE sessions ADD COLUMN model_override TEXT;
ALTER TABLE sessions ADD COLUMN provider_override TEXT;

-- agents (ex-sessions)
ALTER TABLE agents ADD COLUMN deleted_at INTEGER;
ALTER TABLE agents ADD COLUMN verbosity TEXT;
ALTER TABLE agents ADD COLUMN effort TEXT;
ALTER TABLE agents ADD COLUMN model_override TEXT;
ALTER TABLE agents ADD COLUMN provider_override TEXT;
ALTER TABLE agents ADD COLUMN kind TEXT;

-- soft-delete on remaining entities
ALTER TABLE workspaces ADD COLUMN deleted_at INTEGER;
ALTER TABLE workflows  ADD COLUMN deleted_at INTEGER;
ALTER TABLE steps      ADD COLUMN deleted_at INTEGER;
ALTER TABLE skills     ADD COLUMN deleted_at INTEGER;

-- ============================================================
-- PHASE 4: Table rebuilds for CHECK constraint changes + data fix
-- FK OFF here so DROP TABLE on a referenced parent doesn't error.
-- ============================================================

PRAGMA foreign_keys = OFF;

-- 4a. permission_rules: scope CHECK 'task' -> 'session', rename task_id, add deleted_at
DROP TABLE IF EXISTS permission_rules_new;
CREATE TABLE permission_rules_new (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('workspace','session','global')),
  workspace_id TEXT,
  session_id TEXT,
  pattern_tool TEXT NOT NULL,
  pattern_args_matcher TEXT,
  decision TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
INSERT INTO permission_rules_new
  (id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
   decision, priority, created_at, updated_at, deleted_at)
SELECT
  id,
  CASE scope WHEN 'task' THEN 'session' ELSE scope END,
  workspace_id, task_id, pattern_tool, pattern_args_matcher,
  decision, priority, created_at, updated_at, NULL
FROM permission_rules;
DROP TABLE permission_rules;
ALTER TABLE permission_rules_new RENAME TO permission_rules;

-- 4b. permission_audit_log: rename task_id -> session_id (rebuild for FK retarget)
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
  requested_at TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES permission_rules(id) ON DELETE SET NULL
);
INSERT INTO permission_audit_log_new
  (id, run_id, session_id, tool_use_id, tool_name, input_json,
   decision, rule_id, decided_by, requested_at, decided_at)
SELECT id, run_id, task_id, tool_use_id, tool_name, input_json,
   decision, rule_id, decided_by, requested_at, decided_at
FROM permission_audit_log;
DROP TABLE permission_audit_log;
ALTER TABLE permission_audit_log_new RENAME TO permission_audit_log;

-- 4c. budget_alerts: kind CHECK 'task-*' -> 'session-*', rename task_id
DROP TABLE IF EXISTS budget_alerts_new;
CREATE TABLE budget_alerts_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('provider-threshold','provider-exceeded','session-threshold','session-exceeded')),
  provider TEXT,
  session_id TEXT,
  current_usd REAL NOT NULL,
  cap_usd REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
INSERT INTO budget_alerts_new
  (id, kind, provider, session_id, current_usd, cap_usd, created_at, dismissed_at)
SELECT
  id,
  CASE kind
    WHEN 'task-threshold' THEN 'session-threshold'
    WHEN 'task-exceeded' THEN 'session-exceeded'
    ELSE kind
  END,
  provider, task_id, current_usd, cap_usd, created_at, dismissed_at
FROM budget_alerts;
DROP TABLE budget_alerts;
ALTER TABLE budget_alerts_new RENAME TO budget_alerts;

-- 4d. diff_comments: status CHECK += 'deleted', rename task_id
DROP TABLE IF EXISTS diff_comments_new;
CREATE TABLE diff_comments_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'consumed', 'deleted')) DEFAULT 'open',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  consumed_at INTEGER,
  consumed_by_agent_id TEXT,
  line_number INTEGER,
  line_side TEXT CHECK (line_side IN ('old', 'new')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (consumed_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);
INSERT INTO diff_comments_new
  (id, session_id, file_path, body, status, created_at, resolved_at,
   consumed_at, consumed_by_agent_id, line_number, line_side)
SELECT id, task_id, file_path, body, status, created_at, resolved_at,
   consumed_at, consumed_by_agent_id, line_number, line_side
FROM diff_comments;
DROP TABLE diff_comments;
ALTER TABLE diff_comments_new RENAME TO diff_comments;

-- 4e. notifications: add FKs + clean up orphans (rebuild)
DROP TABLE IF EXISTS notifications_new;
CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  session_id TEXT,
  workspace_id TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);
INSERT INTO notifications_new (id, ts, kind, title, body, severity, session_id, workspace_id, read)
SELECT
  n.id, n.ts, n.kind, n.title, n.body, n.severity,
  CASE WHEN n.session_id IS NOT NULL AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = n.session_id)
       THEN n.session_id ELSE NULL END,
  CASE WHEN n.workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = n.workspace_id)
       THEN n.workspace_id ELSE NULL END,
  n.read
FROM notifications n;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

-- ============================================================
-- PHASE 5: Drop ALL existing indices (we recreate the right ones in phase 6)
-- ============================================================

DROP INDEX IF EXISTS idx_tasks_workspace_id;
DROP INDEX IF EXISTS idx_messages_task_id;
DROP INDEX IF EXISTS idx_messages_task_created;
DROP INDEX IF EXISTS idx_messages_agent_id;
DROP INDEX IF EXISTS idx_messages_agent_created;
DROP INDEX IF EXISTS idx_provider_runs_task_id;
DROP INDEX IF EXISTS idx_telemetry_run_id;
DROP INDEX IF EXISTS idx_telemetry_task_id;
DROP INDEX IF EXISTS idx_telemetry_task_kind;
DROP INDEX IF EXISTS idx_budget_rules_provider;
DROP INDEX IF EXISTS idx_budget_alerts_task_id;
DROP INDEX IF EXISTS idx_budget_alerts_provider;
DROP INDEX IF EXISTS idx_budget_alerts_created_at;
DROP INDEX IF EXISTS idx_skills_workspace_id;
DROP INDEX IF EXISTS idx_workflows_workspace_id;
DROP INDEX IF EXISTS idx_steps_workflow_id;
DROP INDEX IF EXISTS idx_sessions_task_id;
DROP INDEX IF EXISTS idx_sessions_group;
DROP INDEX IF EXISTS idx_permission_rules_scope;
DROP INDEX IF EXISTS idx_permission_rules_workspace_id;
DROP INDEX IF EXISTS idx_permission_rules_task_id;
DROP INDEX IF EXISTS idx_permission_audit_task_id;
DROP INDEX IF EXISTS idx_permission_audit_run_id;
DROP INDEX IF EXISTS idx_permission_audit_retry_created;
DROP INDEX IF EXISTS idx_task_worktrees_task_id;
DROP INDEX IF EXISTS idx_parallel_groups_task;
DROP INDEX IF EXISTS idx_turn_events_agent_created;
DROP INDEX IF EXISTS idx_turn_events_task_created;
DROP INDEX IF EXISTS idx_context_slot_history_task_key;
DROP INDEX IF EXISTS idx_github_pr_cache_branch;
DROP INDEX IF EXISTS idx_diff_comments_task_status;
DROP INDEX IF EXISTS idx_diff_comments_task_file;
DROP INDEX IF EXISTS idx_diff_comments_task_file_line;
DROP INDEX IF EXISTS idx_diff_comments_consumed_by;
DROP INDEX IF EXISTS idx_session_plans_session;
DROP INDEX IF EXISTS idx_plan_consumptions_plan;
DROP INDEX IF EXISTS idx_plan_consumptions_agent;

-- ============================================================
-- PHASE 6: Recreate indices (new naming, FK gaps filled, partials)
-- ============================================================

-- sessions (ex-tasks)
CREATE INDEX idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX idx_sessions_active
  ON sessions(workspace_id, updated_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX idx_sessions_archived
  ON sessions(workspace_id, archived_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NOT NULL;

-- messages (no standalone session_id / agent_id idx - composite covers)
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX idx_messages_agent_created ON messages(agent_id, created_at);

-- provider_runs
CREATE INDEX idx_provider_runs_session_id ON provider_runs(session_id);

-- telemetry_records (composite covers task_id-only queries)
CREATE INDEX idx_telemetry_run_id ON telemetry_records(run_id);
CREATE INDEX idx_telemetry_session_kind ON telemetry_records(session_id, kind);

-- budget_rules / budget_alerts
CREATE INDEX idx_budget_rules_provider ON budget_rules(provider);
CREATE INDEX idx_budget_alerts_session_id ON budget_alerts(session_id);
CREATE INDEX idx_budget_alerts_provider ON budget_alerts(provider);
CREATE INDEX idx_budget_alerts_active
  ON budget_alerts(created_at DESC)
  WHERE dismissed_at IS NULL;

-- agents (ex-sessions)
CREATE INDEX idx_agents_session_id ON agents(session_id);
CREATE INDEX idx_agents_group ON agents(group_id);
CREATE INDEX idx_agents_step_id ON agents(step_id) WHERE step_id IS NOT NULL;
CREATE INDEX idx_agents_active ON agents(session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_unread ON agents(session_id, last_finished_at DESC);

-- permission_rules / permission_audit_log
CREATE INDEX idx_permission_rules_scope ON permission_rules(scope);
CREATE INDEX idx_permission_rules_workspace_id ON permission_rules(workspace_id);
CREATE INDEX idx_permission_rules_session_id ON permission_rules(session_id);
CREATE INDEX idx_permission_audit_session_id ON permission_audit_log(session_id);
CREATE INDEX idx_permission_audit_run_id ON permission_audit_log(run_id);
CREATE INDEX idx_permission_audit_rule_id ON permission_audit_log(rule_id);

-- permission_audit_retry
CREATE INDEX idx_permission_audit_retry_created ON permission_audit_retry(created_at);

-- session_worktrees (ex-task_worktrees) + UNIQUE path
CREATE INDEX idx_session_worktrees_session_id ON session_worktrees(session_id);
CREATE UNIQUE INDEX idx_session_worktrees_path ON session_worktrees(worktree_path);

-- parallel_groups
CREATE INDEX idx_parallel_groups_session ON parallel_groups(session_id);

-- turn_events
CREATE INDEX idx_turn_events_agent_created ON turn_events(agent_id, created_at);
CREATE INDEX idx_turn_events_session_created ON turn_events(session_id, created_at);

-- context_slot_history
CREATE INDEX idx_context_slot_history_session_key
  ON context_slot_history(session_id, key, created_at DESC);

-- github_pr_cache
CREATE INDEX idx_github_pr_cache_branch ON github_pr_cache(branch);

-- diff_comments
CREATE INDEX idx_diff_comments_session_status ON diff_comments(session_id, status);
CREATE INDEX idx_diff_comments_session_file_line
  ON diff_comments(session_id, file_path, line_side, line_number);
CREATE INDEX idx_diff_comments_consumed_by ON diff_comments(consumed_by_agent_id);

-- session_plans
CREATE INDEX idx_session_plans_session ON session_plans(session_id, created_at ASC);
CREATE INDEX idx_session_plans_agent_id ON session_plans(agent_id);

-- plan_consumptions
CREATE INDEX idx_plan_consumptions_plan ON plan_consumptions(plan_id, consumed_at DESC);
CREATE INDEX idx_plan_consumptions_agent ON plan_consumptions(agent_id);

-- notifications (new)
CREATE INDEX idx_notifications_unread ON notifications(ts DESC) WHERE read = 0;
CREATE INDEX idx_notifications_session_id ON notifications(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_notifications_workspace_id ON notifications(workspace_id) WHERE workspace_id IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
