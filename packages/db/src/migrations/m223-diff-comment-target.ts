export const m223DiffCommentTarget = `
ALTER TABLE diff_comments ADD COLUMN project_id TEXT;
ALTER TABLE diff_comments ADD COLUMN branch TEXT;

UPDATE diff_comments
SET project_id = (
      SELECT MIN(w.project_id) FROM resolve_attempts a
      JOIN session_worktrees w ON w.id = a.mount_id
      WHERE a.session_id = diff_comments.session_id
        AND w.project_id IS NOT NULL
        AND (
          a.thread_ids_json LIKE '%"note:' || diff_comments.id || '"%'
          OR a.thread_ids_json LIKE '%"note:' || diff_comments.id || ':g%'
        )
    ),
    branch = (
      SELECT MIN(w.branch) FROM resolve_attempts a
      JOIN session_worktrees w ON w.id = a.mount_id
      WHERE a.session_id = diff_comments.session_id
        AND w.project_id IS NOT NULL
        AND (
          a.thread_ids_json LIKE '%"note:' || diff_comments.id || '"%'
          OR a.thread_ids_json LIKE '%"note:' || diff_comments.id || ':g%'
        )
    )
WHERE (
  SELECT COUNT(DISTINCT w.project_id || char(31) || w.branch) FROM resolve_attempts a
  JOIN session_worktrees w ON w.id = a.mount_id
  WHERE a.session_id = diff_comments.session_id
    AND w.project_id IS NOT NULL
    AND (
      a.thread_ids_json LIKE '%"note:' || diff_comments.id || '"%'
      OR a.thread_ids_json LIKE '%"note:' || diff_comments.id || ':g%'
    )
) = 1;

CREATE INDEX idx_diff_comments_target ON diff_comments(session_id, project_id, branch);
`;
