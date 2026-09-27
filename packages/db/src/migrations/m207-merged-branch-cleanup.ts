export const m207MergedBranchCleanup = `
ALTER TABLE workspaces ADD COLUMN after_merge TEXT
  CHECK (after_merge IS NULL OR after_merge IN ('ask', 'local', 'local-and-origin'));
UPDATE workspaces SET after_merge = 'ask';
ALTER TABLE projects ADD COLUMN after_merge TEXT
  CHECK (after_merge IS NULL OR after_merge IN ('ask', 'local', 'local-and-origin'));
ALTER TABLE session_worktrees ADD COLUMN branch_origin TEXT NOT NULL DEFAULT 'unknown'
  CHECK (branch_origin IN ('created', 'adopted', 'unknown'));
CREATE TABLE deleted_branches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT,
  repo_root TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  keep_ref TEXT NOT NULL,
  on_origin INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER NOT NULL,
  restored_at INTEGER
);
CREATE INDEX idx_deleted_branches_project ON deleted_branches(project_id, deleted_at);

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS session_events_new;

CREATE TABLE session_events_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'worktree_created',
    'branch_created',
    'branch_switched',
    'branch_deleted',
    'branch_restored',
    'issue_linked',
    'issue_unlinked',
    'pr_created',
    'pr_discovered',
    'pr_ready',
    'pr_approved',
    'pr_merged',
    'pr_closed',
    'workflow_started',
    'workflow_discarded',
    'workflow_restored',
    'workflow_closed',
    'workflow_deleted',
    'decisions_changed',
    'project_materialized',
    'project_materialization_refused',
    'project_materialization_proposed',
    'project_materialization_dismissed',
    'project_detached',
    'external_task_created',
    'rebase_requested',
    'session_archived',
    'session_restored',
    'write_destination_changed',
    'question_dismissed',
    'question_restored',
    'history_rewritten',
    'history_pushed',
    'history_stopped',
    'history_restored'
  )),
  payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO session_events_new (id, session_id, kind, payload_json, created_at)
  SELECT id, session_id, kind, payload_json, created_at
  FROM session_events;

DROP TABLE session_events;
ALTER TABLE session_events_new RENAME TO session_events;

DROP INDEX IF EXISTS idx_session_events_session_id;
CREATE INDEX idx_session_events_session_id ON session_events(session_id, created_at);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
