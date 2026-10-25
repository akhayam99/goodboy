export const m235AutoPointerKeys = `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS auto_trees_new;

CREATE TABLE auto_trees_new (
  id TEXT PRIMARY KEY,
  root_agent_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  primary_mount_id TEXT,
  generation INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  phase TEXT NOT NULL DEFAULT 'answering' CHECK (
    phase IN ('answering', 'deciding', 'delegating', 'waiting', 'merging', 'done', 'finished', 'blocked', 'stopping', 'stopped')
  ),
  phase_rev INTEGER NOT NULL DEFAULT 0 CHECK (phase_rev >= 0),
  blocked_reason TEXT,
  active_run_id TEXT,
  active_delivery_id TEXT,
  is_yield_requested INTEGER NOT NULL DEFAULT 0 CHECK (is_yield_requested IN (0, 1)),
  stop_state TEXT NOT NULL DEFAULT 'none' CHECK (stop_state IN ('none', 'requested', 'confirming', 'confirmed')),
  cap_usd REAL CHECK (cap_usd IS NULL OR cap_usd >= 0),
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
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (primary_mount_id) REFERENCES session_worktrees(id) ON DELETE SET NULL
);

INSERT INTO auto_trees_new
  (id, root_agent_id, session_id, primary_mount_id, generation, phase, phase_rev, blocked_reason,
   active_run_id, active_delivery_id, is_yield_requested, stop_state, cap_usd, turns_used,
   delegations_used, attempts_used, refusals_used, last_refusal_key, turn_delegate_calls,
   no_progress_streak, question_cycles, grants, created_at, updated_at, hard_deadline_at,
   scheduler_owner, owner_lease_expires_at)
  SELECT id, root_agent_id, session_id,
   CASE WHEN primary_mount_id IN (SELECT id FROM session_worktrees) THEN primary_mount_id END,
   generation, phase, phase_rev, blocked_reason,
   active_run_id, active_delivery_id, is_yield_requested, stop_state, cap_usd, turns_used,
   delegations_used, attempts_used, refusals_used, last_refusal_key, turn_delegate_calls,
   no_progress_streak, question_cycles, grants, created_at, updated_at, hard_deadline_at,
   scheduler_owner, owner_lease_expires_at
  FROM auto_trees;

DROP TABLE auto_trees;
ALTER TABLE auto_trees_new RENAME TO auto_trees;

DROP INDEX IF EXISTS idx_auto_trees_session;
DROP INDEX IF EXISTS idx_auto_trees_live;
CREATE INDEX idx_auto_trees_session ON auto_trees(session_id);
CREATE INDEX idx_auto_trees_live ON auto_trees(phase) WHERE phase NOT IN ('done', 'finished', 'stopped');

DROP TABLE IF EXISTS auto_delegations_new;

CREATE TABLE auto_delegations_new (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0),
  child_agent_id TEXT NOT NULL,
  first_attempt_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('scout', 'planner', 'investigator', 'reviewer', 'implementer', 'tester', 'docs', 'scribe', 'ci-fixer', 'rewriter')),
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
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE,
  FOREIGN KEY (retry_of) REFERENCES auto_delegations(id) ON DELETE SET NULL
);

INSERT INTO auto_delegations_new
  (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
   first_attempt_id, role, request_json, target_json, routing_json, state, outcome, reason,
   retry_of, revise_of, base_revision, adopted, is_stopping, question_cycles, deadline_at,
   result_json, created_at, settled_at)
  SELECT id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
   first_attempt_id, role, request_json, target_json, routing_json, state, outcome, reason,
   CASE WHEN retry_of IN (SELECT id FROM auto_delegations) THEN retry_of END,
   revise_of, base_revision, adopted, is_stopping, question_cycles, deadline_at,
   result_json, created_at, settled_at
  FROM auto_delegations;

DROP TABLE auto_delegations;
ALTER TABLE auto_delegations_new RENAME TO auto_delegations;

DROP INDEX IF EXISTS idx_auto_delegations_tree;
DROP INDEX IF EXISTS idx_auto_delegations_batch;
DROP INDEX IF EXISTS idx_auto_delegations_open_child;
DROP INDEX IF EXISTS idx_auto_delegations_child;
CREATE INDEX idx_auto_delegations_tree ON auto_delegations(tree_id, state);
CREATE INDEX idx_auto_delegations_batch ON auto_delegations(tree_id, batch_id);
CREATE UNIQUE INDEX idx_auto_delegations_open_child
  ON auto_delegations(child_agent_id) WHERE state <> 'settled';
CREATE INDEX idx_auto_delegations_child ON auto_delegations(child_agent_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
