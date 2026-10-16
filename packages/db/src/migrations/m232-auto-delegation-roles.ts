export const m232AutoDelegationRoles = `
PRAGMA foreign_keys = OFF;

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
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

INSERT INTO auto_delegations_new
  (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
   first_attempt_id, role, request_json, target_json, routing_json, state, outcome, reason,
   retry_of, revise_of, base_revision, adopted, is_stopping, question_cycles, deadline_at,
   result_json, created_at, settled_at)
  SELECT id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
   first_attempt_id, role, request_json, target_json, routing_json, state, outcome, reason,
   retry_of, revise_of, base_revision, adopted, is_stopping, question_cycles, deadline_at,
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
