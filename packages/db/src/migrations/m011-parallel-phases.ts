export const m011ParallelPhases = /* sql */ `
ALTER TABLE session_phase_runs ADD COLUMN group_id TEXT;
ALTER TABLE session_phase_runs ADD COLUMN parallel_index INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS parallel_phase_groups (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  merge_strategy TEXT NOT NULL CHECK (merge_strategy IN ('last_write_wins', 'manual', 'synthesizer_driven')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parallel_phase_groups_session ON parallel_phase_groups(session_id);
CREATE INDEX IF NOT EXISTS idx_session_phase_runs_group ON session_phase_runs(group_id);
`
