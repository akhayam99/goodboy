export const m040OpenQuestions = /* sql */ `
CREATE TABLE open_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_id TEXT,
  created_by_step_ordinal INTEGER,
  owned_by_step_ordinal INTEGER,
  text TEXT NOT NULL,
  suggested_answers TEXT NOT NULL DEFAULT '[]',
  user_answer TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'dismissed')),
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  dismissed_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_open_questions_session ON open_questions(session_id, status);
CREATE INDEX idx_open_questions_workflow ON open_questions(workflow_id, owned_by_step_ordinal);
CREATE UNIQUE INDEX idx_open_questions_session_text_open
  ON open_questions(session_id, text)
  WHERE status = 'open';
`;
