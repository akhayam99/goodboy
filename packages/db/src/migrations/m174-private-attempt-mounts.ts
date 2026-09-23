export const m174PrivateAttemptMounts = /* sql */ `
ALTER TABLE projects ADD COLUMN setup_mode TEXT CHECK (setup_mode IS NULL OR setup_mode IN ('command', 'none'));
ALTER TABLE projects ADD COLUMN setup_command TEXT;
ALTER TABLE projects ADD COLUMN setup_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN setup_updated_at INTEGER;

ALTER TABLE writer_leases ADD COLUMN owner_kind TEXT NOT NULL DEFAULT 'process' CHECK (owner_kind IN ('process', 'application'));

CREATE TABLE IF NOT EXISTS cluster_attempts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  container_agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  graph_revision INTEGER NOT NULL,
  scope_revision INTEGER NOT NULL,
  write_scope_json TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('claimed', 'allocated', 'prepared', 'ineligible', 'failed', 'released')),
  mount_id TEXT,
  mount_revision INTEGER,
  branch TEXT,
  worktree_path TEXT,
  repo_root TEXT,
  lease_id TEXT,
  setup_revision INTEGER,
  setup_command TEXT,
  setup_result TEXT NOT NULL DEFAULT 'pending' CHECK (setup_result IN ('pending', 'succeeded', 'failed', 'source-changed', 'shared-dependencies', 'unset')),
  setup_exit_code INTEGER,
  setup_output TEXT,
  baseline_head_sha TEXT,
  baseline_tree_sha TEXT,
  baseline_status_digest TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (container_agent_id, node_id, attempt_number),
  FOREIGN KEY (container_agent_id) REFERENCES cluster_execution_graphs(container_agent_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cluster_attempts_session_id
  ON cluster_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_cluster_attempts_lease_id
  ON cluster_attempts(lease_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cluster_attempts_live_node
  ON cluster_attempts(container_agent_id, node_id)
  WHERE state IN ('claimed', 'allocated', 'prepared');

CREATE TABLE IF NOT EXISTS cluster_execution_eligibility (
  container_agent_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  graph_revision INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('eligible', 'sequential')),
  reason TEXT,
  target_mount_id TEXT,
  target_head_sha TEXT,
  evaluated_at INTEGER NOT NULL,
  FOREIGN KEY (container_agent_id) REFERENCES cluster_execution_graphs(container_agent_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cluster_execution_eligibility_session_id
  ON cluster_execution_eligibility(session_id);
`;
