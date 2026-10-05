export const m224ArtifactComments = `
CREATE TABLE IF NOT EXISTS artifact_comments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  anchor_json TEXT NOT NULL CHECK (json_valid(anchor_json) AND json_type(anchor_json) = 'object'),
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'addressed', 'open')) DEFAULT 'draft',
  sent_turn_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES session_artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifact_comments_artifact ON artifact_comments(artifact_id, status);
CREATE INDEX IF NOT EXISTS idx_artifact_comments_session ON artifact_comments(session_id);
`;
