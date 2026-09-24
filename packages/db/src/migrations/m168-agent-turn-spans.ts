export const m168AgentTurnSpans = `
CREATE TABLE IF NOT EXISTS agent_turn_spans (
  run_id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_run_id TEXT REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  step_role TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  effort TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL CHECK (ended_at >= started_at),
  end_reason TEXT NOT NULL CHECK (end_reason IN ('succeeded', 'failed', 'cancelled', 'awaiting_user')),
  cost_usd REAL
);
CREATE INDEX IF NOT EXISTS idx_agent_turn_spans_agent ON agent_turn_spans(agent_id, started_at);
CREATE INDEX IF NOT EXISTS idx_agent_turn_spans_session ON agent_turn_spans(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_turn_spans_workflow_run ON agent_turn_spans(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_turn_spans_estimate ON agent_turn_spans(workspace_id, step_role, provider, model, effort, ended_at);
`;
