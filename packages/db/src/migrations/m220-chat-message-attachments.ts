export const m220ChatMessageAttachments = `
CREATE TABLE chat_message_attachments (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type LIKE 'image/%'),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_chat_message_attachments_message
  ON chat_message_attachments (message_id, position);
CREATE INDEX idx_chat_message_attachments_chat
  ON chat_message_attachments (chat_id, created_at);
`;
