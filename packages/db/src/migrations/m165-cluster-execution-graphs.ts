export const m165ClusterExecutionGraphs = /* sql */ `
CREATE TABLE IF NOT EXISTS cluster_execution_graphs (
  container_agent_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  plan_id TEXT,
  goal_title TEXT NOT NULL,
  execution_version INTEGER NOT NULL,
  graph_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  FOREIGN KEY (container_agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cluster_execution_graphs_session_id
  ON cluster_execution_graphs(session_id);
CREATE INDEX IF NOT EXISTS idx_cluster_execution_graphs_workflow_run_id
  ON cluster_execution_graphs(workflow_run_id);

CREATE TABLE IF NOT EXISTS cluster_execution_nodes (
  container_agent_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  agent_id TEXT,
  ordinal INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('scout', 'implementer', 'reviewer', 'tester', 'investigator', 'docs')),
  PRIMARY KEY (container_agent_id, node_id),
  FOREIGN KEY (container_agent_id) REFERENCES cluster_execution_graphs(container_agent_id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cluster_execution_nodes_agent_id
  ON cluster_execution_nodes(agent_id);
`;
