export const m188RefactorBuiltinName = `
UPDATE workflows
SET name = 'Refactor'
WHERE id LIKE 'wf\\_seed\\_refactor-example\\_%' ESCAPE '\\'
  AND name = 'Refactor (example)'
  AND NOT EXISTS (
    SELECT 1 FROM workflows AS taken
    WHERE taken.workspace_id = workflows.workspace_id
      AND taken.name = 'Refactor'
      AND taken.deleted_at IS NULL
      AND taken.is_preset = 1
  );
`;
