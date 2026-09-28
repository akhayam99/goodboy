const EXCLUDED = 'SELECT project_id FROM search_excluded_projects';

type Params = {
  readonly doc: string;
};

export const docTouchesExcludedProjectSql = ({ doc }: Params): string => `(
  ${doc}.project_id IN (${EXCLUDED})
  OR ${doc}.session_id IN (SELECT id FROM sessions WHERE active_project_id IN (${EXCLUDED}))
  OR ${doc}.session_id IN (SELECT session_id FROM session_worktrees WHERE project_id IN (${EXCLUDED}))
  OR ${doc}.mount_id IN (SELECT id FROM session_worktrees WHERE project_id IN (${EXCLUDED}))
  OR (${doc}.kind = 'pr' AND EXISTS (
    SELECT 1 FROM session_worktrees w
    WHERE w.repo_slug = ${doc}.container AND w.branch = ${doc}.ref_id
      AND w.project_id IN (${EXCLUDED})
  ))
)`;
