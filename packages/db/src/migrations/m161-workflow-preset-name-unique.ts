export const m161WorkflowPresetNameUnique = /* sql */ `
DROP INDEX IF EXISTS idx_workflows_workspace_name_live;

CREATE UNIQUE INDEX idx_workflows_workspace_name_live
  ON workflows(workspace_id, name)
  WHERE deleted_at IS NULL AND is_preset = 1;
`;
