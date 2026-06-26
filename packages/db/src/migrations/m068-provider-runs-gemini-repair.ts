export const m068ProviderRunsGeminiRepair = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS provider_runs_repair;

CREATE TABLE provider_runs_repair (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic','openai','cursor','codex','gemini')),
  model TEXT NOT NULL,
  status_kind TEXT NOT NULL CHECK (status_kind IN ('pending','streaming','succeeded','failed','cancelled')),
  status_payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO provider_runs_repair (id, session_id, provider, model, status_kind, status_payload, created_at)
  SELECT id, session_id, provider, model, status_kind, status_payload, created_at
  FROM provider_runs;

DROP TABLE provider_runs;
ALTER TABLE provider_runs_repair RENAME TO provider_runs;

DROP INDEX IF EXISTS idx_provider_runs_session_id;
CREATE INDEX idx_provider_runs_session_id ON provider_runs(session_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
