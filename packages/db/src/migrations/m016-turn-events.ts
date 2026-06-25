export const m016TurnEvents = /* sql */ `
CREATE TABLE turn_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_turn_events_agent_created ON turn_events(agent_id, created_at);
CREATE INDEX idx_turn_events_task_created ON turn_events(task_id, created_at);

INSERT INTO turn_events (id, task_id, agent_id, payload, created_at)
SELECT
  m.id,
  m.task_id,
  m.agent_id,
  CASE m.role
    WHEN 'user' THEN json_object(
      'kind', 'user_text',
      'runId', 'history',
      'text', m.content,
      'at', strftime('%Y-%m-%dT%H:%M:%fZ', m.created_at / 1000.0, 'unixepoch')
    )
    WHEN 'assistant' THEN json_object(
      'kind', 'assistant_text',
      'runId', 'history',
      'delta', m.content,
      'at', strftime('%Y-%m-%dT%H:%M:%fZ', m.created_at / 1000.0, 'unixepoch')
    )
  END,
  m.created_at
FROM messages m
WHERE m.role IN ('user', 'assistant');
`
