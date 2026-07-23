export const m073SessionExternalTaskGithubProvider = `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS session_external_tasks_new;

CREATE TABLE session_external_tasks_new (
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'sentry', 'gitlab', 'github')),
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, provider, external_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO session_external_tasks_new (session_id, provider, external_id, identifier, url, title, created_at)
  SELECT session_id, provider, external_id, identifier, url, title, created_at
  FROM session_external_tasks;

DROP TABLE session_external_tasks;
ALTER TABLE session_external_tasks_new RENAME TO session_external_tasks;

DROP INDEX IF EXISTS idx_session_external_tasks_provider_external;
CREATE INDEX idx_session_external_tasks_provider_external
  ON session_external_tasks(provider, external_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
