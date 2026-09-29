export const m213ResolveBatches = `
CREATE TABLE resolve_batches (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  thread_ids_json TEXT NOT NULL CHECK (json_valid(thread_ids_json)),
  launch_choice_json TEXT NOT NULL CHECK (json_valid(launch_choice_json)),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_resolve_batches_session ON resolve_batches(session_id, created_at);

CREATE TABLE resolve_session_settings (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  parallel_limit INTEGER NOT NULL DEFAULT 4 CHECK (parallel_limit BETWEEN 1 AND 16),
  updated_at INTEGER NOT NULL
);

ALTER TABLE resolve_attempts ADD COLUMN batch_id TEXT REFERENCES resolve_batches(id) ON DELETE SET NULL;
ALTER TABLE resolve_attempts ADD COLUMN copy_path TEXT;
ALTER TABLE resolve_attempts ADD COLUMN launch_choice_json TEXT CHECK (launch_choice_json IS NULL OR json_valid(launch_choice_json));
CREATE INDEX idx_resolve_attempts_batch ON resolve_attempts(batch_id);

ALTER TABLE resolve_threads ADD COLUMN git_state TEXT CHECK (git_state IS NULL OR git_state IN ('local', 'on_origin', 'fixed_elsewhere', 'folded', 'missing'));
ALTER TABLE resolve_threads ADD COLUMN verdict_json TEXT CHECK (verdict_json IS NULL OR json_valid(verdict_json));
ALTER TABLE resolve_threads ADD COLUMN source_snapshot_json TEXT CHECK (source_snapshot_json IS NULL OR json_valid(source_snapshot_json));
ALTER TABLE resolve_threads ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'github' CHECK (source_kind IN ('github', 'gitlab', 'bitbucket', 'local'));
ALTER TABLE resolve_threads ADD COLUMN provider_thread_id TEXT;
UPDATE resolve_threads SET source_kind = 'local' WHERE origin_kind = 'diff_comment';
`;
