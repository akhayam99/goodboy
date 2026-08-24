export const m134SessionActiveProjects = /* sql */ `
UPDATE sessions
SET active_project_id = (
  SELECT worktree.project_id
  FROM session_worktrees worktree
  JOIN projects project ON project.id = worktree.project_id
  WHERE worktree.session_id = sessions.id
    AND project.workspace_id = sessions.workspace_id
  ORDER BY worktree.parallel_index, worktree.created_at, worktree.id
  LIMIT 1
)
WHERE active_project_id IS NULL;

UPDATE sessions
SET active_project_id = (
  SELECT project.id
  FROM projects project
  WHERE project.workspace_id = sessions.workspace_id
)
WHERE active_project_id IS NULL
  AND (
    SELECT COUNT(*)
    FROM projects project
    WHERE project.workspace_id = sessions.workspace_id
  ) = 1;
`;
