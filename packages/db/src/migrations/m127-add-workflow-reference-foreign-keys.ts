export const m127AddWorkflowReferenceForeignKeys = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS open_questions_new;

CREATE TABLE open_questions_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_id TEXT,
  created_by_step_ordinal INTEGER,
  owned_by_step_ordinal INTEGER,
  text TEXT NOT NULL,
  suggested_answers TEXT NOT NULL DEFAULT '[]',
  user_answer TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'dismissed')),
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  dismissed_at INTEGER,
  created_by_agent_id TEXT,
  workflow_run_id TEXT,
  turn_ordinal INTEGER,
  recommended_answer TEXT,
  select_mode TEXT CHECK (select_mode IS NULL OR select_mode IN ('one', 'many')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

INSERT INTO open_questions_new (
  id, session_id, workflow_id, created_by_step_ordinal, owned_by_step_ordinal,
  text, suggested_answers, user_answer, status, created_at, answered_at,
  dismissed_at, created_by_agent_id, workflow_run_id, turn_ordinal,
  recommended_answer, select_mode
)
SELECT
  id,
  session_id,
  workflow_id,
  created_by_step_ordinal,
  owned_by_step_ordinal,
  text,
  suggested_answers,
  user_answer,
  status,
  created_at,
  answered_at,
  dismissed_at,
  created_by_agent_id,
  CASE
    WHEN workflow_run_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM session_workflows
        WHERE session_workflows.workflow_run_id = open_questions.workflow_run_id
      )
      THEN workflow_run_id
    ELSE NULL
  END,
  turn_ordinal,
  recommended_answer,
  select_mode
FROM open_questions;

DROP TABLE open_questions;
ALTER TABLE open_questions_new RENAME TO open_questions;

DROP INDEX IF EXISTS idx_open_questions_created_by_agent;
CREATE INDEX idx_open_questions_created_by_agent ON open_questions(created_by_agent_id);
DROP INDEX IF EXISTS idx_open_questions_run_id;
CREATE INDEX idx_open_questions_run_id
  ON open_questions(workflow_run_id, owned_by_step_ordinal);
DROP INDEX IF EXISTS idx_open_questions_session;
CREATE INDEX idx_open_questions_session ON open_questions(session_id, status);
DROP INDEX IF EXISTS idx_open_questions_session_text_open;
CREATE UNIQUE INDEX idx_open_questions_session_text_open
  ON open_questions(session_id, text)
  WHERE status = 'open';
DROP INDEX IF EXISTS idx_open_questions_workflow;
CREATE INDEX idx_open_questions_workflow
  ON open_questions(workflow_id, owned_by_step_ordinal);

DROP TABLE IF EXISTS session_plans_new;

CREATE TABLE session_plans_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'superseded', 'discarded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  clusters_json TEXT,
  workflow_run_id TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

INSERT INTO session_plans_new (
  id, session_id, agent_id, title, body_md, status, created_at, updated_at,
  clusters_json, workflow_run_id
)
SELECT
  id,
  session_id,
  agent_id,
  title,
  body_md,
  status,
  created_at,
  updated_at,
  clusters_json,
  CASE
    WHEN workflow_run_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM session_workflows
        WHERE session_workflows.workflow_run_id = session_plans.workflow_run_id
      )
      THEN workflow_run_id
    ELSE NULL
  END
FROM session_plans;

DROP TABLE session_plans;
ALTER TABLE session_plans_new RENAME TO session_plans;

DROP INDEX IF EXISTS idx_session_plans_agent_id;
CREATE INDEX idx_session_plans_agent_id ON session_plans(agent_id);
DROP INDEX IF EXISTS idx_session_plans_run_id;
CREATE INDEX idx_session_plans_run_id
  ON session_plans(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;
DROP INDEX IF EXISTS idx_session_plans_session;
CREATE INDEX idx_session_plans_session ON session_plans(session_id, created_at ASC);

DROP TABLE IF EXISTS file_versions_new;

CREATE TABLE file_versions_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  change_kind TEXT NOT NULL CHECK (change_kind IN ('modified', 'deleted')),
  snapshot_source TEXT NOT NULL CHECK (snapshot_source IN ('agent_turn', 'restore')),
  provider_run_id TEXT,
  captured_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_run_id) REFERENCES provider_runs(id) ON DELETE SET NULL
);

INSERT INTO file_versions_new (
  id, session_id, relative_path, stored_name, size_bytes, content_hash,
  change_kind, snapshot_source, provider_run_id, captured_at
)
SELECT
  id,
  session_id,
  relative_path,
  stored_name,
  size_bytes,
  content_hash,
  change_kind,
  snapshot_source,
  CASE
    WHEN provider_run_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM provider_runs
        WHERE provider_runs.id = file_versions.provider_run_id
      )
      THEN provider_run_id
    ELSE NULL
  END,
  captured_at
FROM file_versions;

DROP TABLE file_versions;
ALTER TABLE file_versions_new RENAME TO file_versions;

DROP INDEX IF EXISTS idx_file_versions_session_path_captured;
CREATE INDEX idx_file_versions_session_path_captured
  ON file_versions(session_id, relative_path, captured_at DESC);
CREATE INDEX idx_file_versions_provider_run_id
  ON file_versions(provider_run_id)
  WHERE provider_run_id IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
