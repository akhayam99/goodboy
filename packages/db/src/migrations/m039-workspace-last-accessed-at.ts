export const m039WorkspaceLastAccessedAt = /* sql */ `
ALTER TABLE workspaces ADD COLUMN last_accessed_at INTEGER;
UPDATE workspaces SET last_accessed_at = updated_at;
CREATE INDEX idx_workspaces_last_accessed_at ON workspaces(last_accessed_at);
`
