export const m135SupersedeDiscardedWorkflowPlans = /* sql */ `
UPDATE session_plans
SET status = 'superseded'
WHERE status = 'active'
  AND workflow_run_id IN (
    SELECT workflow_run_id
    FROM session_workflows
    WHERE discarded_at IS NOT NULL
  );
`;
