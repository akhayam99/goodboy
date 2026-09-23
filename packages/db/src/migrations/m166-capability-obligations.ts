export const m166CapabilityObligations = /* sql */ `
CREATE TABLE IF NOT EXISTS capability_obligations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  identity TEXT NOT NULL UNIQUE,
  requester_agent_id TEXT NOT NULL,
  target_role TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('discovery', 'diagnosis', 'repair', 'test', 'replan')),
  state TEXT NOT NULL CHECK (state IN ('open', 'granted', 'satisfied', 'refused')),
  owner_agent_id TEXT,
  decision TEXT CHECK (decision IS NULL OR decision IN ('granted', 'refused', 'attached', 'refinement')),
  child_agent_id TEXT,
  delivered_at INTEGER,
  delivery_receipt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  FOREIGN KEY (requester_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (child_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_capability_obligations_session_id
  ON capability_obligations(session_id);
CREATE INDEX IF NOT EXISTS idx_capability_obligations_workflow_run_id
  ON capability_obligations(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_capability_obligations_requester_agent_id
  ON capability_obligations(requester_agent_id);
CREATE INDEX IF NOT EXISTS idx_capability_obligations_open_state
  ON capability_obligations(session_id, state);

CREATE TABLE IF NOT EXISTS capability_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  obligation_id TEXT NOT NULL,
  requester_agent_id TEXT NOT NULL,
  source_turn_id TEXT NOT NULL,
  target_role TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('discovery', 'diagnosis', 'repair', 'test', 'replan')),
  question TEXT NOT NULL,
  scope_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  gap TEXT NOT NULL DEFAULT '',
  expected_output TEXT NOT NULL DEFAULT '',
  continuation TEXT NOT NULL CHECK (continuation IN ('resume', 'transfer', 'handoff')),
  routing_proposal TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (requester_agent_id, source_turn_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  FOREIGN KEY (obligation_id) REFERENCES capability_obligations(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capability_requests_session_id
  ON capability_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_capability_requests_obligation_id
  ON capability_requests(obligation_id);

CREATE TABLE IF NOT EXISTS capability_obligation_holds (
  obligation_id TEXT NOT NULL,
  hold_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (obligation_id, hold_id),
  FOREIGN KEY (obligation_id) REFERENCES capability_obligations(id) ON DELETE CASCADE,
  FOREIGN KEY (hold_id) REFERENCES cluster_completion_holds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capability_obligation_holds_hold_id
  ON capability_obligation_holds(hold_id);

ALTER TABLE agents ADD COLUMN execution_purpose TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_execution_purpose
  ON agents(execution_purpose);

UPDATE agents
   SET execution_purpose = 'standalone'
 WHERE execution_purpose IS NULL
   AND parent_agent_id IS NULL;

UPDATE agents
   SET execution_purpose = 'question-delegate'
 WHERE execution_purpose IS NULL
   AND source_kind = 'open_question';

UPDATE agents
   SET execution_purpose = 'cluster'
 WHERE execution_purpose IS NULL
   AND id IN (SELECT agent_id FROM cluster_execution_nodes WHERE agent_id IS NOT NULL);

DROP VIEW IF EXISTS live_agents;
CREATE VIEW live_agents AS SELECT * FROM agents WHERE deleted_at IS NULL;
`;
