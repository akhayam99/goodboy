export const m193WorkspacePermissionDefault = `
ALTER TABLE workspaces ADD COLUMN default_permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions'
  CHECK (default_permission_mode IN ('plan', 'default', 'dontAsk', 'acceptEdits', 'bypassPermissions'));
`;
