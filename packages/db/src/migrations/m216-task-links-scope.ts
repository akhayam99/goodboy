export const m216TaskLinksScope = `
ALTER TABLE workspaces ADD COLUMN default_branch_template TEXT;
ALTER TABLE projects ADD COLUMN default_branch_template TEXT;

ALTER TABLE session_external_tasks ADD COLUMN scope TEXT NOT NULL DEFAULT 'session'
  CHECK (scope IN ('session', 'branch'));
ALTER TABLE session_external_tasks ADD COLUMN relation TEXT NOT NULL DEFAULT 'closes'
  CHECK (relation IN ('closes', 'part-of'));

UPDATE session_external_tasks
   SET branch = (
     SELECT w.branch
       FROM session_worktrees w
      WHERE w.session_id = session_external_tasks.session_id
        AND w.branch <> ''
      ORDER BY CASE WHEN w.project_id IS session_external_tasks.project_id THEN 0 ELSE 1 END,
               w.parallel_index ASC,
               w.created_at ASC
      LIMIT 1
   )
 WHERE branch IS NULL;

DROP INDEX IF EXISTS idx_session_external_tasks_identity;
CREATE UNIQUE INDEX idx_session_external_tasks_identity
  ON session_external_tasks(
    session_id,
    provider,
    external_id,
    COALESCE(project_id, ''),
    COALESCE(CASE scope WHEN 'branch' THEN branch END, '')
  );

DROP TRIGGER IF EXISTS search_linked_issue_delete;
CREATE TRIGGER search_linked_issue_delete AFTER DELETE ON session_external_tasks
WHEN NOT EXISTS (
  SELECT 1 FROM session_external_tasks t
   WHERE t.session_id = OLD.session_id
     AND t.provider = OLD.provider
     AND t.external_id = OLD.external_id
)
BEGIN
  DELETE FROM search_docs WHERE id = 'task:' || OLD.session_id || ':' || OLD.provider || ':' || OLD.external_id;
END;

CREATE TABLE IF NOT EXISTS workspace_external_tasks (
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, provider, external_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
`;
