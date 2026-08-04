export const m103SessionExternalTaskBranch = /* sql */ `
ALTER TABLE session_external_tasks ADD COLUMN branch TEXT;

UPDATE session_external_tasks
   SET branch = (
     SELECT w.branch
       FROM session_worktrees w
      WHERE w.session_id = session_external_tasks.session_id
      ORDER BY w.parallel_index ASC
      LIMIT 1
   )
 WHERE branch IS NULL;
`;
