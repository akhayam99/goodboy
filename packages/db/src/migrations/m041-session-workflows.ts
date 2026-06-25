export const m041SessionWorkflows = /* sql */ `
-- Create session_workflows junction table to support 1:n relationship.
-- current_step_ordinal tracks per-workflow step progress independently.
CREATE TABLE session_workflows (
  session_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  current_step_ordinal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, workflow_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_session_workflows_session_id ON session_workflows(session_id);
CREATE INDEX idx_session_workflows_workflow_id ON session_workflows(workflow_id);

-- Backfill from legacy sessions.workflow_id + sessions.current_step_ordinal (added in m014).
INSERT INTO session_workflows (session_id, workflow_id, ordinal, current_step_ordinal)
SELECT id, workflow_id, 0, COALESCE(current_step_ordinal, 0)
FROM sessions
WHERE workflow_id IS NOT NULL;
`
