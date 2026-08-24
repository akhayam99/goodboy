export const m128NormalizeGoalAttachmentOwners = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS goal_attachments_new;

CREATE TABLE goal_attachments_new (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  workflow_run_id TEXT,
  rel_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK ((session_id IS NOT NULL) <> (workflow_run_id IS NOT NULL)),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE CASCADE
);

INSERT INTO goal_attachments_new (
  id, session_id, workflow_run_id, rel_path, kind, file_name, mime_type, created_at
)
SELECT
  id,
  CASE WHEN owner_type = 'session' THEN owner_id ELSE NULL END,
  CASE WHEN owner_type = 'workflow_run' THEN owner_id ELSE NULL END,
  rel_path,
  kind,
  file_name,
  mime_type,
  created_at
FROM goal_attachments
WHERE (
    owner_type = 'session'
    AND EXISTS (
      SELECT 1
      FROM sessions
      WHERE sessions.id = goal_attachments.owner_id
    )
  )
  OR (
    owner_type = 'workflow_run'
    AND EXISTS (
      SELECT 1
      FROM session_workflows
      WHERE session_workflows.workflow_run_id = goal_attachments.owner_id
    )
  );

DROP TABLE goal_attachments;
ALTER TABLE goal_attachments_new RENAME TO goal_attachments;

DROP INDEX IF EXISTS idx_goal_attachments_owner;
CREATE INDEX idx_goal_attachments_session_id
  ON goal_attachments(session_id)
  WHERE session_id IS NOT NULL;
CREATE INDEX idx_goal_attachments_workflow_run_id
  ON goal_attachments(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
