export const m185AgentHandoffs = `
CREATE TABLE IF NOT EXISTS agent_handoffs (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  sender_json TEXT NOT NULL CHECK (json_valid(sender_json)),
  ask TEXT NOT NULL,
  why TEXT,
  done_when TEXT,
  sections_json TEXT NOT NULL CHECK (json_valid(sections_json)),
  sent_system TEXT,
  sent_message TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;
