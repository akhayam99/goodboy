export const m117RenameProjects = /* sql */ `
ALTER TABLE workspaces RENAME TO projects;

DROP INDEX IF EXISTS idx_workspaces_active;
CREATE INDEX idx_projects_active ON projects(disconnected_at);

DROP INDEX IF EXISTS idx_workspaces_last_accessed_at;
CREATE INDEX idx_projects_last_accessed_at ON projects(last_accessed_at);
`;
