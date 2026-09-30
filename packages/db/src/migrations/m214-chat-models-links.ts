export const m214ChatModelsLinks = `
ALTER TABLE chats ADD COLUMN effort TEXT NULL;
ALTER TABLE chat_messages ADD COLUMN provider TEXT NULL;
ALTER TABLE chat_messages ADD COLUMN model TEXT NULL;
ALTER TABLE chat_messages ADD COLUMN effort TEXT NULL;
UPDATE chat_messages
SET provider = (SELECT c.provider FROM chats c WHERE c.id = chat_messages.chat_id),
    model = (SELECT c.model FROM chats c WHERE c.id = chat_messages.chat_id)
WHERE role = 'assistant';
CREATE TABLE chat_session_links (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message_id TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('new', 'add')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_chat_session_links_chat ON chat_session_links (chat_id, created_at);
CREATE INDEX idx_chat_session_links_session ON chat_session_links (session_id);
`;
