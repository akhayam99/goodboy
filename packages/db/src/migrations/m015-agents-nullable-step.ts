export const m015AgentsNullableStep = /* sql */ `
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
`;
