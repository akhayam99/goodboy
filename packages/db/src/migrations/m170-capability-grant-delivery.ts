export const m170CapabilityGrantDelivery = /* sql */ `
ALTER TABLE capability_obligations ADD COLUMN decision_reason TEXT;
ALTER TABLE capability_obligations ADD COLUMN satisfied_revision TEXT;

CREATE TABLE IF NOT EXISTS capability_grants (
  id TEXT PRIMARY KEY,
  obligation_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  granted_role TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('discovery', 'diagnosis', 'repair', 'test', 'replan')),
  continuation TEXT NOT NULL CHECK (continuation IN ('resume', 'transfer', 'handoff')),
  parent_outcome TEXT NOT NULL CHECK (parent_outcome IN ('resumed', 'transferred', 'handed-off')),
  child_agent_id TEXT,
  replacement_agent_id TEXT,
  verification_agent_id TEXT,
  transferred_work TEXT,
  state TEXT NOT NULL CHECK (state IN ('pending', 'delivered', 'settled', 'cancelled', 'failed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (obligation_id) REFERENCES capability_obligations(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  FOREIGN KEY (child_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (replacement_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (verification_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_capability_grants_session_id
  ON capability_grants(session_id);
CREATE INDEX IF NOT EXISTS idx_capability_grants_workflow_run_id
  ON capability_grants(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_capability_grants_child_agent_id
  ON capability_grants(child_agent_id);
CREATE INDEX IF NOT EXISTS idx_capability_grants_state
  ON capability_grants(session_id, state);
`;
