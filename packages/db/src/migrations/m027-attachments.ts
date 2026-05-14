export const m027Attachments = /* sql */ `
CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_message_id ON attachments(message_id);
CREATE INDEX idx_attachments_task_id ON attachments(task_id);
CREATE INDEX idx_attachments_sha256 ON attachments(sha256);
`;
