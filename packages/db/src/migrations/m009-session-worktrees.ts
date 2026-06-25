export const m009SessionWorktrees = /* sql */ `
CREATE TABLE IF NOT EXISTS session_worktrees (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  branch TEXT NOT NULL,
  parallel_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_worktrees_session_id ON session_worktrees(session_id);
`
