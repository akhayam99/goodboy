export const m227AskTelemetryThreads = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS telemetry_records_new;

CREATE TABLE telemetry_records_new (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'turn' CHECK (kind IN ('turn','summarizer','orchestrator','ask')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd REAL NOT NULL,
  recorded_at INTEGER NOT NULL,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  context_tokens INTEGER,
  FOREIGN KEY (run_id) REFERENCES provider_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO telemetry_records_new
  (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens,
   estimated_cost_usd, recorded_at, cached_input_tokens, cache_creation_input_tokens, context_tokens)
  SELECT id, run_id, session_id, kind, provider, model, input_tokens, output_tokens,
   estimated_cost_usd, recorded_at, cached_input_tokens, cache_creation_input_tokens, context_tokens
  FROM telemetry_records;

DROP TABLE telemetry_records;
ALTER TABLE telemetry_records_new RENAME TO telemetry_records;

DROP INDEX IF EXISTS idx_telemetry_run_id;
DROP INDEX IF EXISTS idx_telemetry_session_kind;
DROP INDEX IF EXISTS idx_telemetry_recorded_at;
DROP INDEX IF EXISTS idx_telemetry_provider;
CREATE INDEX idx_telemetry_run_id ON telemetry_records(run_id);
CREATE INDEX idx_telemetry_session_kind ON telemetry_records(session_id, kind);
CREATE INDEX idx_telemetry_recorded_at ON telemetry_records(recorded_at);
CREATE INDEX idx_telemetry_provider ON telemetry_records(provider);

ALTER TABLE chats ADD COLUMN session_id TEXT NULL REFERENCES sessions(id) ON DELETE CASCADE;
CREATE INDEX idx_chats_session_activity ON chats (session_id, last_activity_at);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
