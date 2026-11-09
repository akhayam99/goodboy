export const m240BrowserTabs = `
CREATE TABLE browser_tabs (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((session_id IS NULL) <> (project_id IS NULL))
);

CREATE INDEX idx_browser_tabs_session ON browser_tabs(session_id, position);
CREATE INDEX idx_browser_tabs_project ON browser_tabs(project_id, position);
`;
