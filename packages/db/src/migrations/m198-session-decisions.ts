export const m198SessionDecisions = `
CREATE TABLE IF NOT EXISTS session_decisions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'replaced', 'withdrawn')),
  replaced_by INTEGER NULL,
  author TEXT NOT NULL CHECK (author IN ('agent', 'summarizer', 'user')),
  agent_id TEXT NULL,
  turn_ordinal INTEGER NULL,
  reason TEXT NULL,
  closed_by TEXT NULL CHECK (closed_by IS NULL OR closed_by IN ('agent', 'summarizer', 'user')),
  closed_by_agent_id TEXT NULL,
  previous_text TEXT NULL,
  reworded_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, number),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_decisions_session ON session_decisions (session_id, number);
`;
