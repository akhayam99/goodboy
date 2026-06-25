export const m026Notifications = /* sql */ `
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  session_id TEXT,
  workspace_id TEXT,
  read INTEGER NOT NULL DEFAULT 0
);
`
