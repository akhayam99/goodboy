export const m054WorkflowRunInstances = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS session_workflows_new;
CREATE TABLE session_workflows_new (
  workflow_run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  current_step_ordinal INTEGER NOT NULL DEFAULT 0,
  auto_run INTEGER NOT NULL DEFAULT 0,
  discarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

INSERT INTO session_workflows_new
  (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, discarded_at, created_at)
SELECT
  lower(hex(randomblob(16))),
  sw.session_id,
  sw.workflow_id,
  sw.ordinal,
  sw.current_step_ordinal,
  COALESCE(s.auto_run, 0),
  sw.discarded_at,
  sw.created_at
FROM session_workflows sw
JOIN sessions s ON s.id = sw.session_id;

DROP TABLE session_workflows;
ALTER TABLE session_workflows_new RENAME TO session_workflows;

CREATE INDEX idx_session_workflows_session_id ON session_workflows(session_id, ordinal);
CREATE INDEX idx_session_workflows_workflow_id ON session_workflows(workflow_id);

ALTER TABLE agents ADD COLUMN workflow_run_id TEXT;
UPDATE agents SET workflow_run_id = (
  SELECT sw.workflow_run_id
  FROM session_workflows sw
  JOIN steps st ON st.workflow_id = sw.workflow_id
  WHERE st.id = agents.step_id AND sw.session_id = agents.session_id
)
WHERE step_id IS NOT NULL;
CREATE INDEX idx_agents_workflow_run_id ON agents(workflow_run_id) WHERE workflow_run_id IS NOT NULL;

ALTER TABLE session_plans ADD COLUMN workflow_run_id TEXT;
UPDATE session_plans SET workflow_run_id = (
  SELECT a.workflow_run_id FROM agents a WHERE a.id = session_plans.agent_id
);
CREATE INDEX idx_session_plans_run_id ON session_plans(workflow_run_id) WHERE workflow_run_id IS NOT NULL;

ALTER TABLE open_questions ADD COLUMN workflow_run_id TEXT;
UPDATE open_questions SET workflow_run_id = (
  SELECT sw.workflow_run_id
  FROM session_workflows sw
  WHERE sw.session_id = open_questions.session_id
    AND sw.workflow_id = open_questions.workflow_id
)
WHERE workflow_id IS NOT NULL;
CREATE INDEX idx_open_questions_run_id ON open_questions(workflow_run_id, owned_by_step_ordinal);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`
