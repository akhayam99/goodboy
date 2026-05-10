export const m019TaskPermissionMode = /* sql */ `
ALTER TABLE tasks ADD COLUMN permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions';
`;
