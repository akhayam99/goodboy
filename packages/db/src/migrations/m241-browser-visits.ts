export const m241BrowserVisits = `
CREATE TABLE browser_visits (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, url)
);

CREATE INDEX idx_browser_visits_session ON browser_visits(session_id, updated_at);
`;
