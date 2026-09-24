export const m175ClusterGraphRevisions = `
ALTER TABLE cluster_execution_graphs ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cluster_execution_graphs ADD COLUMN frozen_reason TEXT;
ALTER TABLE cluster_execution_graphs ADD COLUMN frozen_obligation_id TEXT;

ALTER TABLE cluster_execution_nodes ADD COLUMN state TEXT NOT NULL DEFAULT 'active';
ALTER TABLE cluster_execution_nodes ADD COLUMN superseded_by TEXT;
ALTER TABLE cluster_execution_nodes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cluster_execution_nodes ADD COLUMN result_state TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS cluster_graph_revisions (
  id TEXT PRIMARY KEY,
  container_agent_id TEXT NOT NULL,
  obligation_id TEXT,
  from_revision INTEGER NOT NULL,
  to_revision INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('adopted', 'refused')),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (container_agent_id) REFERENCES cluster_execution_graphs(container_agent_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cluster_graph_revisions_container_agent_id
  ON cluster_graph_revisions(container_agent_id, created_at);
`;
