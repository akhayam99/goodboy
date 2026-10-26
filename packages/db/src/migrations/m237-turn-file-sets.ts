export const m237TurnFileSets = `
CREATE TABLE turn_file_sets (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  mount_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  own_json TEXT NOT NULL,
  from_base_json TEXT NOT NULL,
  is_partial INTEGER NOT NULL DEFAULT 0 CHECK (is_partial IN (0, 1)),
  recorded_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (run_id, mount_id)
);

CREATE INDEX idx_turn_file_sets_session ON turn_file_sets(session_id, recorded_at);
`;
