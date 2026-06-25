export const m020DiffComments = /* sql */ `
CREATE TABLE diff_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_diff_comments_task_status ON diff_comments(task_id, status);
CREATE INDEX idx_diff_comments_task_file ON diff_comments(task_id, file_path);
`
