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
  creation_path TEXT NOT NULL CHECK (creation_path IN ('cluster', 'fan-out', 'capability', 'question-delegate', 'workflow-step')),
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

CREATE TABLE IF NOT EXISTS generation_refusals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_run_id TEXT,
  parent_agent_id TEXT NOT NULL,
  causal_root_agent_id TEXT,
  obligation_id TEXT,
  limit_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (parent_agent_id, limit_name),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generation_refusals_session_id
  ON generation_refusals(session_id, created_at);

ALTER TABLE capability_requests ADD COLUMN inventory_revision TEXT NOT NULL DEFAULT '';
`;
