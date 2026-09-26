export const m190DropUnusedOverrides = `
ALTER TABLE workspaces DROP COLUMN default_workflow_id;
ALTER TABLE workspaces DROP COLUMN parallel_enabled;
ALTER TABLE projects DROP COLUMN default_workflow_id;
ALTER TABLE projects DROP COLUMN parallel_enabled;
ALTER TABLE sessions DROP COLUMN default_workflow_id;
ALTER TABLE sessions DROP COLUMN parallel_enabled;
`;
