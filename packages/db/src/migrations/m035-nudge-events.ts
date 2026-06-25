export const m035NudgeEvents = /* sql */ `
CREATE TABLE IF NOT EXISTS nudge_events (
  id TEXT PRIMARY KEY NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  context_json TEXT,
  outcome TEXT,
  outcome_ts TEXT
);
CREATE INDEX IF NOT EXISTS idx_nudge_kind_ts ON nudge_events(kind, ts);
`
