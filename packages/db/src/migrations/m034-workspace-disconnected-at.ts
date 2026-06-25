export const m034WorkspaceDisconnectedAt = /* sql */ `
ALTER TABLE workspaces ADD COLUMN disconnected_at INTEGER;
CREATE INDEX idx_workspaces_active ON workspaces(disconnected_at);
`
