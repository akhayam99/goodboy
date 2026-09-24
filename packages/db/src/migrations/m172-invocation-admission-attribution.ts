export const m172InvocationAdmissionAttribution = `
ALTER TABLE workspaces ADD COLUMN invocation_global_limit INTEGER CHECK (invocation_global_limit IS NULL OR invocation_global_limit > 0);
ALTER TABLE workspaces ADD COLUMN invocation_provider_limit INTEGER CHECK (invocation_provider_limit IS NULL OR invocation_provider_limit > 0);
ALTER TABLE workspaces ADD COLUMN invocation_heavyweight_limit INTEGER CHECK (invocation_heavyweight_limit IS NULL OR invocation_heavyweight_limit > 0);

CREATE TABLE IF NOT EXISTS invocation_tickets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  session_id TEXT,
  workflow_run_id TEXT,
  agent_id TEXT,
  provider TEXT NOT NULL,
  provider_identity TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('agent_turn','orchestrator','summarizer','planner','auxiliary')),
  is_heavyweight INTEGER NOT NULL CHECK (is_heavyweight IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('queued','admitted','running','released')),
  process_id INTEGER,
  exit_code INTEGER,
  release_reason TEXT,
  owner_process_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  admitted_at INTEGER,
  started_at INTEGER,
  released_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_invocation_tickets_status_created ON invocation_tickets(status, created_at);
CREATE INDEX IF NOT EXISTS idx_invocation_tickets_provider_identity_status ON invocation_tickets(provider_identity, status);
CREATE INDEX IF NOT EXISTS idx_invocation_tickets_workflow_run_id ON invocation_tickets(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_invocation_tickets_agent_id ON invocation_tickets(agent_id);

ALTER TABLE telemetry_records ADD COLUMN invocation_id TEXT;
ALTER TABLE telemetry_records ADD COLUMN workflow_run_id TEXT;
ALTER TABLE telemetry_records ADD COLUMN agent_id TEXT;
ALTER TABLE telemetry_records ADD COLUMN purpose TEXT CHECK (purpose IS NULL OR purpose IN ('agent_turn','orchestrator','summarizer','planner','auxiliary'));
ALTER TABLE telemetry_records ADD COLUMN usage_event_id TEXT;
ALTER TABLE telemetry_records ADD COLUMN attribution_status TEXT NOT NULL DEFAULT 'unattributed' CHECK (attribution_status IN ('attributed','unattributed'));
CREATE INDEX IF NOT EXISTS idx_telemetry_workflow_run_id ON telemetry_records(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_invocation_id ON telemetry_records(invocation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_invocation_usage_event ON telemetry_records(invocation_id, usage_event_id) WHERE invocation_id IS NOT NULL AND usage_event_id IS NOT NULL;
`;
