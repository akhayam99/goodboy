export const m015AgentsPerChat = /* sql */ `
-- Step 1: rebuild sessions (= agents) with nullable step_id so users can
-- spawn ad-hoc free agents without going through a workflow.
CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  step_id TEXT,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_run_id TEXT,
  output_summary TEXT,
  group_id TEXT,
  parallel_index INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE SET NULL
);

INSERT INTO sessions_new (
  id, task_id, step_id, ordinal, name, status,
  provider_run_id, output_summary, group_id, parallel_index,
  started_at, completed_at
)
SELECT
  id, task_id, step_id, ordinal, name, status,
  provider_run_id, output_summary, group_id, parallel_index,
  started_at, completed_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX idx_sessions_task_id ON sessions(task_id);
CREATE INDEX idx_sessions_group ON sessions(group_id);

-- Step 2: scope every task that has messages but no session row to a fresh
-- "agent 1" so message backfill in step 3 is safe.
INSERT INTO sessions (id, task_id, step_id, ordinal, name, status, parallel_index)
SELECT
  lower(hex(randomblob(16))),
  t.id,
  NULL,
  0,
  'agent 1',
  'pending',
  0
FROM tasks t
WHERE EXISTS (SELECT 1 FROM messages m WHERE m.task_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.task_id = t.id);

-- Step 3: add agent_id to messages, backfill from the lowest-ordinal session
-- of each task (the earliest agent), then enforce NOT NULL via table rebuild.
CREATE TABLE messages_new (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  provider_override_id TEXT,
  provider_override_model TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO messages_new (
  id, task_id, agent_id, role, content,
  provider_override_id, provider_override_model, created_at
)
SELECT
  m.id,
  m.task_id,
  (SELECT s.id FROM sessions s WHERE s.task_id = m.task_id ORDER BY s.ordinal ASC LIMIT 1),
  m.role,
  m.content,
  m.provider_override_id,
  m.provider_override_model,
  m.created_at
FROM messages m;

DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

CREATE INDEX idx_messages_task_id ON messages(task_id);
CREATE INDEX idx_messages_task_created ON messages(task_id, created_at);
CREATE INDEX idx_messages_agent_id ON messages(agent_id);
CREATE INDEX idx_messages_agent_created ON messages(agent_id, created_at);
`
