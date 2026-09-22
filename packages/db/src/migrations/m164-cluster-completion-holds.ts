export const m164ClusterCompletionHolds = /* sql */ `
CREATE TABLE IF NOT EXISTS cluster_completion_holds (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  container_agent_id TEXT NOT NULL,
  source_agent_id TEXT NOT NULL,
  source_turn_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('missing-outcome', 'malformed-outcome', 'foreign-outcome', 'unresolved-outcome')),
  findings_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK (state IN ('open', 'resolved')),
  resolution_evidence TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (source_agent_id, source_turn_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  FOREIGN KEY (container_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (source_agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cluster_completion_holds_session_id
  ON cluster_completion_holds(session_id);
CREATE INDEX IF NOT EXISTS idx_cluster_completion_holds_workflow_run_id
  ON cluster_completion_holds(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_cluster_completion_holds_container_agent_id
  ON cluster_completion_holds(container_agent_id);
CREATE INDEX IF NOT EXISTS idx_cluster_completion_holds_source_agent_id
  ON cluster_completion_holds(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_cluster_completion_holds_open_container
  ON cluster_completion_holds(container_agent_id, state);
`;
