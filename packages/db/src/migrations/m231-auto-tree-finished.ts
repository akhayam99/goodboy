export const m231AutoTreeFinished = `
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
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO auto_trees_new
  (id, root_agent_id, session_id, primary_mount_id, generation, phase, phase_rev, blocked_reason,
   active_run_id, active_delivery_id, is_yield_requested, stop_state, cap_usd, turns_used,
   delegations_used, attempts_used, refusals_used, last_refusal_key, turn_delegate_calls,
   no_progress_streak, question_cycles, grants, created_at, updated_at, hard_deadline_at,
   scheduler_owner, owner_lease_expires_at)
  SELECT id, root_agent_id, session_id, primary_mount_id, generation, phase, phase_rev, blocked_reason,
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

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
