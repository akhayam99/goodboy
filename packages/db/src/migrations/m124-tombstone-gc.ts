export const m124TombstoneGc = /* sql */ `
DELETE FROM workflows
WHERE deleted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM session_workflows
    WHERE session_workflows.workflow_id = workflows.id
  );

DELETE FROM steps
WHERE deleted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM agents
    WHERE agents.step_id = steps.id
  );

DELETE FROM step_library
WHERE deleted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM steps
    WHERE steps.library_step_id = step_library.id
  );
`;
