export const m167DropDeadWorkspaceAndHintColumns = `
ALTER TABLE workspaces DROP COLUMN sessions_root;
ALTER TABLE session_workflows DROP COLUMN orchestrator_hints;
`;
