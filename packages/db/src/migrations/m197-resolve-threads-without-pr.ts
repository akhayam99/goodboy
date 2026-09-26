export const m197ResolveThreadsWithoutPr = `
PRAGMA foreign_keys = OFF;

ALTER TABLE diff_comments ADD COLUMN author_kind TEXT NOT NULL DEFAULT 'user' CHECK (author_kind IN ('user', 'agent'));
ALTER TABLE diff_comments ADD COLUMN author_agent_id TEXT;

DROP TABLE IF EXISTS resolve_threads_new;

CREATE TABLE resolve_threads_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  project_id TEXT,
  pr_number INTEGER,
  thread_id TEXT NOT NULL,
  origin_kind TEXT NOT NULL CHECK (origin_kind IN ('review_comment', 'issue_comment', 'diff_comment')),
  diff_comment_id TEXT REFERENCES diff_comments(id) ON DELETE SET NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'working', 'needs_answer', 'fixed', 'answered', 'failed', 'publishing', 'closed')),
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'working', 'asking', 'proposed', 'approved', 'publishing', 'failed', 'parked', 'resolved')),
  state_reason TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active_attempt_id TEXT,
  disposition TEXT CHECK (disposition IN ('fix', 'reply', 'no_change')),
  reply_draft TEXT,
  commit_shas_json TEXT CHECK (commit_shas_json IS NULL OR json_valid(commit_shas_json)),
  fixup_of_sha TEXT,
  replaces_sha TEXT,
  question TEXT,
  reply_posted_at INTEGER,
  reply_id TEXT,
  github_resolved INTEGER CHECK (github_resolved IN (0, 1)),
  closed_at INTEGER,
  closed_source TEXT CHECK (closed_source IN ('goodboy', 'github')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, thread_id)
);

INSERT INTO resolve_threads_new (
  id, session_id, project_id, pr_number, thread_id, origin_kind, diff_comment_id, state, stage,
  state_reason, revision, active_attempt_id, disposition, reply_draft, commit_shas_json,
  fixup_of_sha, replaces_sha, question, reply_posted_at, reply_id, github_resolved, closed_at,
  closed_source, created_at, updated_at
)
SELECT
  id, session_id, project_id, CASE WHEN pr_number > 0 THEN pr_number ELSE NULL END, thread_id,
  origin_kind, NULL, state, stage, state_reason, revision, active_attempt_id, disposition,
  reply_draft, commit_shas_json, fixup_of_sha, replaces_sha, question, reply_posted_at, reply_id,
  github_resolved, closed_at, closed_source, created_at, updated_at
FROM resolve_threads;

DROP TABLE resolve_threads;
ALTER TABLE resolve_threads_new RENAME TO resolve_threads;

CREATE INDEX IF NOT EXISTS idx_resolve_threads_session_state ON resolve_threads(session_id, state);
CREATE INDEX IF NOT EXISTS idx_resolve_threads_attempt ON resolve_threads(active_attempt_id);
CREATE INDEX IF NOT EXISTS idx_resolve_threads_diff_comment ON resolve_threads(diff_comment_id);

DROP TABLE IF EXISTS resolve_attempts_new;

CREATE TABLE resolve_attempts_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  pr_number INTEGER,
  thread_ids_json TEXT NOT NULL CHECK (json_valid(thread_ids_json)),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  effort TEXT,
  instructions TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('queued', 'running', 'waiting', 'finished', 'failed', 'cancelled')),
  mount_id TEXT,
  mount_revision INTEGER,
  worktree_path TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
);

INSERT INTO resolve_attempts_new (
  id, session_id, agent_id, pr_number, thread_ids_json, provider, model, effort, instructions,
  phase, mount_id, mount_revision, worktree_path, started_at, ended_at, error, created_at
)
SELECT
  id, session_id, agent_id, CASE WHEN pr_number > 0 THEN pr_number ELSE NULL END,
  thread_ids_json, provider, model, effort, instructions, phase, mount_id, mount_revision,
  worktree_path, started_at, ended_at, error, created_at
FROM resolve_attempts;

DROP TABLE resolve_attempts;
ALTER TABLE resolve_attempts_new RENAME TO resolve_attempts;

CREATE INDEX IF NOT EXISTS idx_resolve_attempts_session ON resolve_attempts(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_resolve_attempts_agent ON resolve_attempts(agent_id);
CREATE INDEX IF NOT EXISTS idx_resolve_attempts_mount ON resolve_attempts(mount_id);

INSERT OR IGNORE INTO resolve_threads (
  id, session_id, project_id, pr_number, thread_id, origin_kind, diff_comment_id, state, stage,
  revision, created_at, updated_at
)
SELECT
  'note-' || note.id, note.session_id, NULL, NULL, 'note:' || note.id, 'diff_comment', note.id,
  'open', 'new', 0, note.created_at, note.created_at
FROM diff_comments note
JOIN sessions ON sessions.id = note.session_id
WHERE note.status = 'open';

INSERT OR IGNORE INTO resolve_queue_items (
  id, session_id, thread_id, generation, candidate_revision, approval_state, created_at, updated_at
)
SELECT
  'queue-note-' || note.id, note.session_id, 'note:' || note.id, 0, 0, 'none',
  note.created_at, note.created_at
FROM diff_comments note
JOIN sessions ON sessions.id = note.session_id
WHERE note.status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM resolve_queue_items existing
    WHERE existing.session_id = note.session_id
      AND existing.thread_id = 'note:' || note.id
      AND existing.superseded_at IS NULL
  );

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
