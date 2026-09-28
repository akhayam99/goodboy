export const m212Chats = `
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'codex')),
  model TEXT NOT NULL,
  pinned_at INTEGER NULL,
  archived_at INTEGER NULL,
  last_activity_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_chats_workspace_activity ON chats (workspace_id, archived_at, last_activity_at);
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('streaming', 'done', 'failed', 'stopped')),
  reads TEXT NULL,
  error TEXT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
CREATE INDEX idx_chat_messages_chat_created ON chat_messages (chat_id, created_at);
`;
