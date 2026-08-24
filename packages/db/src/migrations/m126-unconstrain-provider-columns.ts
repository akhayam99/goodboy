export const m126UnconstrainProviderColumns = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS provider_runs_new;

CREATE TABLE provider_runs_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status_kind TEXT NOT NULL CHECK (status_kind IN ('pending','streaming','succeeded','failed','cancelled')),
  status_payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO provider_runs_new (
  id, session_id, provider, model, status_kind, status_payload, created_at
)
SELECT id, session_id, provider, model, status_kind, status_payload, created_at
FROM provider_runs;

DROP TABLE provider_runs;
ALTER TABLE provider_runs_new RENAME TO provider_runs;

DROP INDEX IF EXISTS idx_provider_runs_session_id;
CREATE INDEX idx_provider_runs_session_id ON provider_runs(session_id);

DROP TABLE IF EXISTS session_external_tasks_new;

CREATE TABLE session_external_tasks_new (
  session_id TEXT NOT NULL,
  project_id TEXT,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  branch TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO session_external_tasks_new (
  session_id, project_id, provider, external_id, identifier, url, title, created_at, branch
)
SELECT session_id, project_id, provider, external_id, identifier, url, title, created_at, branch
FROM session_external_tasks;

DROP TABLE session_external_tasks;
ALTER TABLE session_external_tasks_new RENAME TO session_external_tasks;

DROP INDEX IF EXISTS idx_session_external_tasks_provider_external;
CREATE INDEX idx_session_external_tasks_provider_external
  ON session_external_tasks(provider, external_id);
DROP INDEX IF EXISTS idx_session_external_tasks_identity;
CREATE UNIQUE INDEX idx_session_external_tasks_identity
  ON session_external_tasks(
    session_id,
    provider,
    external_id,
    COALESCE(project_id, '')
  );

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
