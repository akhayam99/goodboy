export const m230AutoRegistry = `
CREATE TABLE IF NOT EXISTS auto_trees (
  id TEXT PRIMARY KEY,
  root_agent_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  primary_mount_id TEXT,
  generation INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  phase TEXT NOT NULL DEFAULT 'answering' CHECK (
    phase IN ('answering', 'deciding', 'delegating', 'waiting', 'merging', 'done', 'blocked', 'stopping', 'stopped')
  ),
  phase_rev INTEGER NOT NULL DEFAULT 0 CHECK (phase_rev >= 0),
  blocked_reason TEXT,
  active_run_id TEXT,
  active_delivery_id TEXT,
  is_yield_requested INTEGER NOT NULL DEFAULT 0 CHECK (is_yield_requested IN (0, 1)),
  stop_state TEXT NOT NULL DEFAULT 'none' CHECK (stop_state IN ('none', 'requested', 'confirming', 'confirmed')),
  cap_usd REAL NOT NULL CHECK (cap_usd >= 0),
  turns_used INTEGER NOT NULL DEFAULT 0 CHECK (turns_used >= 0),
  delegations_used INTEGER NOT NULL DEFAULT 0 CHECK (delegations_used >= 0),
  attempts_used INTEGER NOT NULL DEFAULT 0 CHECK (attempts_used >= 0),
  refusals_used INTEGER NOT NULL DEFAULT 0 CHECK (refusals_used >= 0),
  last_refusal_key TEXT,
  turn_delegate_calls INTEGER NOT NULL DEFAULT 0 CHECK (turn_delegate_calls >= 0),
  no_progress_streak INTEGER NOT NULL DEFAULT 0 CHECK (no_progress_streak >= 0),
  question_cycles INTEGER NOT NULL DEFAULT 0 CHECK (question_cycles >= 0),
  grants INTEGER NOT NULL DEFAULT 0 CHECK (grants >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  hard_deadline_at INTEGER NOT NULL,
  scheduler_owner TEXT,
  owner_lease_expires_at INTEGER,
  FOREIGN KEY (root_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agents_auto_roots ON agents(session_id, ordinal) WHERE kind = 'auto' AND parent_agent_id IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auto_trees_session ON auto_trees(session_id);
CREATE INDEX IF NOT EXISTS idx_auto_trees_live ON auto_trees(phase) WHERE phase NOT IN ('done', 'stopped');

CREATE TABLE IF NOT EXISTS auto_delegations (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0),
  child_agent_id TEXT NOT NULL,
  first_attempt_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('scout', 'planner', 'investigator', 'reviewer', 'implementer', 'tester', 'docs')),
  request_json TEXT NOT NULL CHECK (json_valid(request_json) AND json_type(request_json) = 'object'),
  target_json TEXT NOT NULL CHECK (json_valid(target_json) AND json_type(target_json) = 'object'),
  routing_json TEXT NOT NULL CHECK (json_valid(routing_json) AND json_type(routing_json) = 'object'),
  state TEXT NOT NULL DEFAULT 'accepted' CHECK (
    state IN ('accepted', 'awaiting_confirm', 'starting', 'running', 'paused', 'settled')
  ),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('completed', 'failed', 'blocked', 'stopped', 'timed_out')),
  reason TEXT,
  retry_of TEXT,
  revise_of TEXT,
  base_revision INTEGER CHECK (base_revision IS NULL OR base_revision >= 1),
  adopted INTEGER NOT NULL DEFAULT 0 CHECK (adopted IN (0, 1)),
  is_stopping INTEGER NOT NULL DEFAULT 0 CHECK (is_stopping IN (0, 1)),
  question_cycles INTEGER NOT NULL DEFAULT 0 CHECK (question_cycles >= 0),
  deadline_at INTEGER NOT NULL,
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at INTEGER NOT NULL,
  settled_at INTEGER,
  UNIQUE (tree_id, request_id, slot),
  CHECK ((state = 'settled') = (outcome IS NOT NULL)),
  CHECK (state <> 'settled' OR settled_at IS NOT NULL),
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auto_delegations_tree ON auto_delegations(tree_id, state);
CREATE INDEX IF NOT EXISTS idx_auto_delegations_batch ON auto_delegations(tree_id, batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_delegations_open_child
  ON auto_delegations(child_agent_id) WHERE state <> 'settled';
CREATE INDEX IF NOT EXISTS idx_auto_delegations_child ON auto_delegations(child_agent_id);

CREATE TABLE IF NOT EXISTS auto_attempts (
  id TEXT PRIMARY KEY,
  delegation_id TEXT NOT NULL,
  tree_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
  state TEXT NOT NULL DEFAULT 'starting' CHECK (state IN ('starting', 'running', 'paused', 'ended')),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('completed', 'failed', 'blocked', 'stopped', 'timed_out')),
  run_id TEXT,
  question_id TEXT,
  baseline_json TEXT CHECK (baseline_json IS NULL OR json_valid(baseline_json)),
  result_snapshot_json TEXT CHECK (result_snapshot_json IS NULL OR json_valid(result_snapshot_json)),
  write_set_json TEXT CHECK (write_set_json IS NULL OR json_valid(write_set_json)),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  end_reason TEXT,
  UNIQUE (delegation_id, ordinal),
  CHECK ((state = 'ended') = (outcome IS NOT NULL)),
  FOREIGN KEY (delegation_id) REFERENCES auto_delegations(id) ON DELETE CASCADE,
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auto_attempts_tree ON auto_attempts(tree_id, state);
CREATE INDEX IF NOT EXISTS idx_auto_attempts_run ON auto_attempts(run_id) WHERE run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auto_reservations (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('attempt', 'auto_turn', 'aux')),
  owner_id TEXT NOT NULL,
  reserved_usd REAL NOT NULL CHECK (reserved_usd >= 0),
  state TEXT NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'reconciled', 'released')),
  actual_usd REAL CHECK (actual_usd IS NULL OR actual_usd >= 0),
  cost_known INTEGER CHECK (cost_known IS NULL OR cost_known IN (0, 1)),
  released_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (tree_id, owner_kind, owner_id),
  CHECK ((state = 'reconciled') = (actual_usd IS NOT NULL)),
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auto_reservations_tree ON auto_reservations(tree_id, state);

CREATE TABLE IF NOT EXISTS auto_outbox (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('results', 'question', 'user', 'refusal')),
  join_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'claimed', 'accepted', 'dropped')),
  claimed_by TEXT,
  claim_expires_at INTEGER,
  accepted_run_id TEXT,
  dropped_reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (tree_id, join_key),
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auto_outbox_tree ON auto_outbox(tree_id, state, created_at);

CREATE TABLE IF NOT EXISTS auto_artifacts (
  artifact_id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'report', 'wireframe')),
  owner_agent_id TEXT NOT NULL,
  owner_delegation_id TEXT NOT NULL,
  owner_role TEXT NOT NULL CHECK (owner_role IN ('scout', 'planner', 'investigator', 'reviewer', 'implementer', 'tester', 'docs')),
  approval_state TEXT NOT NULL DEFAULT 'needs_approval' CHECK (approval_state IN ('needs_approval', 'approved', 'revising')),
  approved_revision INTEGER CHECK (approved_revision IS NULL OR approved_revision >= 1),
  open_revise_delegation_id TEXT,
  rev INTEGER NOT NULL DEFAULT 0 CHECK (rev >= 0),
  created_at INTEGER NOT NULL,
  CHECK (approval_state <> 'approved' OR approved_revision IS NOT NULL),
  CHECK (approval_state <> 'revising' OR open_revise_delegation_id IS NOT NULL),
  FOREIGN KEY (artifact_id) REFERENCES session_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auto_artifacts_tree ON auto_artifacts(tree_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_artifacts_owner ON auto_artifacts(owner_agent_id);

CREATE TABLE IF NOT EXISTS auto_artifact_versions (
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  delegation_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  base_revision INTEGER CHECK (base_revision IS NULL OR base_revision >= 1),
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, revision),
  UNIQUE (artifact_id, attempt_id),
  FOREIGN KEY (artifact_id) REFERENCES auto_artifacts(artifact_id) ON DELETE CASCADE
);
`;
