/**
 * m048 — widen session_external_tasks provider CHECK to include 'jira'.
 *
 * Same rebuild-to-widen pattern as m047. Existing Linear rows survive.
 */
export const m048WidenSessionExternalTask = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS session_external_tasks_new;
CREATE TABLE session_external_tasks_new (
  session_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('linear', 'jira')),
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
INSERT INTO session_external_tasks_new SELECT * FROM session_external_tasks;
DROP TABLE session_external_tasks;
ALTER TABLE session_external_tasks_new RENAME TO session_external_tasks;
CREATE INDEX IF NOT EXISTS idx_session_external_tasks_provider_external
  ON session_external_tasks(provider, external_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
