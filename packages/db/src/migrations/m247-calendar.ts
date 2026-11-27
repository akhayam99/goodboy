export const m247Calendar = `
CREATE TABLE calendar_sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('eventkit', 'ics')),
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  host TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((kind = 'ics') = (host IS NOT NULL))
);

CREATE UNIQUE INDEX idx_calendar_sources_eventkit ON calendar_sources(kind) WHERE kind = 'eventkit';

CREATE TABLE calendar_roles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES calendar_sources(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'show' CHECK (role IN ('show', 'busy', 'focus', 'hide')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (source_id, calendar_id)
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('time', 'ci_green', 'agent_done', 'call_end')),
  due_at INTEGER,
  target_kind TEXT CHECK (target_kind IN ('session', 'pull_request', 'event')),
  target_id TEXT,
  snoozed_until INTEGER,
  done_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((target_kind IS NULL) = (target_id IS NULL)),
  CHECK (trigger_kind <> 'time' OR due_at IS NOT NULL),
  CHECK (trigger_kind <> 'ci_green' OR target_kind IS 'pull_request'),
  CHECK (trigger_kind <> 'agent_done' OR target_kind IS 'session'),
  CHECK (trigger_kind <> 'call_end' OR target_kind IS 'event')
);

CREATE INDEX idx_reminders_workspace ON reminders(workspace_id, done_at, due_at);
`;
