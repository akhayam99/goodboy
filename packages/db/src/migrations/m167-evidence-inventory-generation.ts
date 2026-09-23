export const m167EvidenceInventoryGeneration = /* sql */ `
CREATE TABLE IF NOT EXISTS evidence_inventories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  agent_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  entries_json TEXT NOT NULL DEFAULT '[]',
  omitted_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (agent_id, revision),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_inventories_agent_id
  ON evidence_inventories(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_inventories_session_id
  ON evidence_inventories(session_id);

CREATE TABLE IF NOT EXISTS evidence_delivery_receipts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  source_turn_id TEXT NOT NULL,
  inventory_revision TEXT NOT NULL,
  source_id TEXT NOT NULL,
  requested_range TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('delivered', 'unknown-source', 'unauthorized', 'unavailable')),
  delivered_chars INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE (agent_id, source_turn_id, source_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_delivery_receipts_agent_id
  ON evidence_delivery_receipts(agent_id, created_at);

CREATE TABLE IF NOT EXISTS agent_generation_ledger (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  parent_agent_id TEXT,
  causal_root_agent_id TEXT NOT NULL,
  agent_id TEXT,
  depth INTEGER NOT NULL,
  creation_path TEXT NOT NULL CHECK (creation_path IN ('cluster', 'fan-out', 'capability', 'question-delegate', 'workflow-step', 'legacy')),
  obligation_id TEXT,
  purpose TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_generation_ledger_root
  ON agent_generation_ledger(causal_root_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_generation_ledger_run
  ON agent_generation_ledger(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_generation_ledger_obligation
  ON agent_generation_ledger(obligation_id);
CREATE INDEX IF NOT EXISTS idx_agent_generation_ledger_agent
  ON agent_generation_ledger(agent_id);

INSERT OR IGNORE INTO agent_generation_ledger
  (id, session_id, workflow_run_id, parent_agent_id, causal_root_agent_id, agent_id, depth,
   creation_path, obligation_id, purpose, created_at)
WITH RECURSIVE lineage(agent_id, ancestor_id, depth) AS (
  SELECT id, id, 0 FROM agents
  UNION ALL
  SELECT lineage.agent_id, agents.parent_agent_id, lineage.depth + 1
    FROM lineage
    JOIN agents ON agents.id = lineage.ancestor_id
   WHERE agents.parent_agent_id IS NOT NULL
     AND lineage.depth < 64
),
roots AS (
  SELECT agent_id, ancestor_id, depth
    FROM lineage
   WHERE depth = (SELECT MAX(inner_lineage.depth) FROM lineage AS inner_lineage
                   WHERE inner_lineage.agent_id = lineage.agent_id)
)
SELECT 'legacy:' || agents.id, agents.session_id, agents.workflow_run_id, agents.parent_agent_id,
       roots.ancestor_id, agents.id, roots.depth, 'legacy', NULL, NULL,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM agents
  JOIN roots ON roots.agent_id = agents.id
 WHERE agents.session_id IN (SELECT id FROM sessions)
   AND (agents.parent_agent_id IS NOT NULL OR agents.workflow_run_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS generation_refusals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  parent_agent_id TEXT,
  scope_key TEXT NOT NULL,
  causal_root_agent_id TEXT,
  obligation_id TEXT,
  limit_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, scope_key, limit_name),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generation_refusals_session_id
  ON generation_refusals(session_id, created_at);

ALTER TABLE capability_requests ADD COLUMN inventory_revision TEXT NOT NULL DEFAULT '';
`;
