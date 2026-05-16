export const m028DiffCommentConsumed = /* sql */ `
CREATE TABLE diff_comments_new (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'consumed')) DEFAULT 'open',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  consumed_at INTEGER,
  consumed_by_agent_id TEXT,
  line_number INTEGER,
  line_side TEXT CHECK (line_side IN ('old', 'new')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (consumed_by_agent_id) REFERENCES sessions(id) ON DELETE SET NULL
);

INSERT INTO diff_comments_new (
  id, task_id, file_path, body, status, created_at, resolved_at, line_number, line_side
)
SELECT
  id, task_id, file_path, body, status, created_at, resolved_at, line_number, line_side
FROM diff_comments;

DROP TABLE diff_comments;
ALTER TABLE diff_comments_new RENAME TO diff_comments;

CREATE INDEX idx_diff_comments_task_status ON diff_comments(task_id, status);
CREATE INDEX idx_diff_comments_task_file ON diff_comments(task_id, file_path);
CREATE INDEX idx_diff_comments_task_file_line
  ON diff_comments(task_id, file_path, line_side, line_number);
CREATE INDEX idx_diff_comments_consumed_by ON diff_comments(consumed_by_agent_id);
`;
