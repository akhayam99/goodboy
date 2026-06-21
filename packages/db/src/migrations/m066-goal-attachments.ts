export const m066GoalAttachments = /* sql */ `
CREATE TABLE IF NOT EXISTS goal_attachments (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_attachments_owner
  ON goal_attachments(owner_type, owner_id);
`;
