export const m075PrReviewDrafts = /* sql */ `
CREATE TABLE IF NOT EXISTS pr_review_drafts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  path TEXT NOT NULL,
  line INTEGER NOT NULL,
  start_line INTEGER,
  side TEXT NOT NULL DEFAULT 'new',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  origin TEXT NOT NULL DEFAULT 'agent',
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pr_review_drafts_session
  ON pr_review_drafts(session_id);
`;
