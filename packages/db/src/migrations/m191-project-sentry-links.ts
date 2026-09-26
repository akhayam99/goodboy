export const m191ProjectSentryLinks = `
CREATE TABLE IF NOT EXISTS project_sentry_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sentry_org TEXT NOT NULL,
  sentry_project TEXT NOT NULL,
  sentry_project_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'code_mapping')),
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, sentry_org, sentry_project)
);

CREATE INDEX IF NOT EXISTS idx_project_sentry_links_workspace
  ON project_sentry_links (workspace_id);
`;
