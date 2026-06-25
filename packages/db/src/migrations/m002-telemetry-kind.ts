export const m002TelemetryKind = /* sql */ `
ALTER TABLE telemetry_records ADD COLUMN kind TEXT NOT NULL DEFAULT 'turn'
  CHECK (kind IN ('turn','summarizer'));
CREATE INDEX IF NOT EXISTS idx_telemetry_session_kind ON telemetry_records(session_id, kind);
`
