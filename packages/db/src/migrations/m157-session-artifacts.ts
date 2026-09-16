export const m157SessionArtifacts = /* sql */ `
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS session_artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  workflow_run_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'report', 'wireframe')),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  title TEXT NOT NULL,
  source_format TEXT NOT NULL CHECK (source_format IN ('markdown', 'json')),
  source_text TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json) AND json_type(metadata_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'superseded', 'discarded')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  source_turn_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (id, kind),
  UNIQUE (agent_id, source_turn_id),
  CHECK (status <> 'consumed' OR kind = 'plan'),
  CHECK (
    (kind IN ('plan', 'report') AND source_format = 'markdown')
    OR (kind = 'wireframe' AND source_format = 'json')
  ),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

INSERT INTO session_artifacts (
  id, session_id, agent_id, workflow_run_id, kind, schema_version, title,
  source_format, source_text, metadata_json, status, revision, source_turn_id,
  created_at, updated_at
)
SELECT
  id,
  session_id,
  agent_id,
  workflow_run_id,
  'plan',
  1,
  title,
  'markdown',
  body_md,
  CASE
    WHEN clusters_json IS NULL THEN '{}'
    WHEN json_valid(clusters_json) THEN '{"clusters":' || clusters_json || '}'
    ELSE json_object('unparsableClustersJson', clusters_json)
  END,
  status,
  1,
  NULL,
  created_at,
  updated_at
FROM session_plans;

CREATE TABLE IF NOT EXISTS artifact_renditions (
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  format TEXT NOT NULL,
  renderer_version TEXT NOT NULL,
  bytes BLOB NOT NULL CHECK (length(bytes) <= 20971520),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, revision, format, renderer_version),
  FOREIGN KEY (artifact_id) REFERENCES session_artifacts(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS plan_consumptions_new;

CREATE TABLE plan_consumptions_new (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL DEFAULT 'plan' CHECK (artifact_kind = 'plan'),
  agent_id TEXT NOT NULL,
  consumed_at INTEGER NOT NULL,
  FOREIGN KEY (plan_id, artifact_kind) REFERENCES session_artifacts(id, kind) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

INSERT INTO plan_consumptions_new (id, plan_id, agent_id, consumed_at)
SELECT id, plan_id, agent_id, consumed_at
FROM plan_consumptions;

DROP TABLE plan_consumptions;
ALTER TABLE plan_consumptions_new RENAME TO plan_consumptions;
DROP TABLE session_plans;

CREATE INDEX idx_session_artifacts_session
  ON session_artifacts(session_id, created_at ASC);
CREATE INDEX idx_session_artifacts_agent_id ON session_artifacts(agent_id);
CREATE INDEX idx_session_artifacts_run_id
  ON session_artifacts(workflow_run_id, created_at ASC)
  WHERE workflow_run_id IS NOT NULL;
CREATE INDEX idx_plan_consumptions_plan
  ON plan_consumptions(plan_id, consumed_at DESC);
CREATE INDEX idx_plan_consumptions_agent ON plan_consumptions(agent_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
