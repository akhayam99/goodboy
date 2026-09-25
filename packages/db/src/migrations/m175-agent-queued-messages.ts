export const m175AgentQueuedMessages = `
CREATE TABLE IF NOT EXISTS agent_queued_messages (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  override_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_queued_messages_agent
  ON agent_queued_messages(agent_id, position);
`;
