export const m123StorageCleanup = /* sql */ `
PRAGMA foreign_keys = OFF;

UPDATE workspaces
SET default_branch_prefix = (
  SELECT settings.value
  FROM settings
  WHERE settings.key = 'workspace.' || workspaces.id || '.branch_prefix'
)
WHERE EXISTS (
  SELECT 1
  FROM settings
  WHERE settings.key = 'workspace.' || workspaces.id || '.branch_prefix'
);

DELETE FROM settings
WHERE key LIKE 'workspace.%.branch_prefix'
   OR key LIKE 'workspace.%.agent_title_mode';

ALTER TABLE projects RENAME COLUMN scout_fanout TO parallel_agents;
ALTER TABLE workspaces RENAME COLUMN scout_fanout TO parallel_agents;
ALTER TABLE projects DROP COLUMN deleted_at;
ALTER TABLE skills DROP COLUMN deleted_at;
ALTER TABLE permission_rules DROP COLUMN deleted_at;

DROP TABLE IF EXISTS diff_comments_new;

CREATE TABLE diff_comments_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'consumed')) DEFAULT 'open',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  consumed_at INTEGER,
  consumed_by_agent_id TEXT,
  line_number INTEGER,
  line_side TEXT CHECK (line_side IN ('old', 'new')),
  end_line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (consumed_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

INSERT INTO diff_comments_new (
  id,
  session_id,
  file_path,
  body,
  status,
  created_at,
  resolved_at,
  consumed_at,
  consumed_by_agent_id,
  line_number,
  line_side,
  end_line_number
)
SELECT
  id,
  session_id,
  file_path,
  body,
  status,
  created_at,
  resolved_at,
  consumed_at,
  consumed_by_agent_id,
  line_number,
  line_side,
  end_line_number
FROM diff_comments
WHERE status <> 'deleted';

DROP TABLE diff_comments;
ALTER TABLE diff_comments_new RENAME TO diff_comments;

DROP INDEX IF EXISTS idx_diff_comments_session_status;
CREATE INDEX idx_diff_comments_session_status ON diff_comments(session_id, status);
DROP INDEX IF EXISTS idx_diff_comments_session_file_line;
CREATE INDEX idx_diff_comments_session_file_line
  ON diff_comments(session_id, file_path, line_side, line_number);
DROP INDEX IF EXISTS idx_diff_comments_consumed_by;
CREATE INDEX idx_diff_comments_consumed_by ON diff_comments(consumed_by_agent_id);

DROP TABLE IF EXISTS step_library_new;

CREATE TABLE step_library_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  role TEXT NOT NULL DEFAULT 'custom',
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_default TEXT,
  model_default TEXT,
  effort_default TEXT,
  verbosity_default TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO step_library_new (
  id,
  workspace_id,
  role,
  name,
  prompt_prefix,
  provider_default,
  model_default,
  effort_default,
  verbosity_default,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  id,
  workspace_id,
  role,
  name,
  prompt_prefix,
  provider_default,
  model_default,
  effort_default,
  verbosity_default,
  created_at,
  updated_at,
  deleted_at
FROM step_library;

DROP TABLE step_library;
ALTER TABLE step_library_new RENAME TO step_library;

DROP INDEX IF EXISTS idx_step_library_workspace;
CREATE INDEX idx_step_library_workspace ON step_library(workspace_id);
DROP INDEX IF EXISTS idx_step_library_base;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
