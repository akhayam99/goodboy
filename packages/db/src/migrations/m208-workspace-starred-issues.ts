export const m208WorkspaceStarredIssues = `
CREATE TABLE workspace_starred_issues (
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  container TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  state_label TEXT,
  starred_at INTEGER NOT NULL,
  refreshed_at INTEGER,
  PRIMARY KEY (workspace_id, provider, external_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
`;
