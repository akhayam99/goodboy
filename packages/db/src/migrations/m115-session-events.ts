export const m115SessionEvents = /* sql */ `
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'worktree_created',
    'branch_created',
    'branch_switched',
    'issue_linked',
    'issue_unlinked',
    'pr_created',
    'pr_ready',
    'pr_approved',
    'pr_merged',
    'pr_closed',
    'workflow_started',
    'workflow_discarded',
    'workflow_deleted',
    'decisions_changed'
  )),
  payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id, created_at);
`;
