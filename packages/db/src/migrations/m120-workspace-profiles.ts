export const m120WorkspaceProfiles = /* sql */ `
CREATE TABLE workspace_profiles (
  workspace_id TEXT PRIMARY KEY,
  role TEXT,
  discipline TEXT,
  topics TEXT,
  notes TEXT,
  updated_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
`;
