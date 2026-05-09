export const m017ContextSlotHistory = /* sql */ `
CREATE TABLE context_slot_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('user', 'summarizer')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_context_slot_history_task_key ON context_slot_history(task_id, key, created_at DESC);
`;
