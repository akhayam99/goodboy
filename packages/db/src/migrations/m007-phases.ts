export const m007Phases = /* sql */ `
CREATE TABLE IF NOT EXISTS phase_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_phase_templates_workspace_id ON phase_templates(workspace_id);

CREATE TABLE IF NOT EXISTS phase_definitions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_override TEXT,
  model_override TEXT,
  FOREIGN KEY (template_id) REFERENCES phase_templates(id) ON DELETE CASCADE,
  UNIQUE(template_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_phase_definitions_template_id ON phase_definitions(template_id);

CREATE TABLE IF NOT EXISTS session_phase_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  phase_definition_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_run_id TEXT,
  output_summary TEXT,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (phase_definition_id) REFERENCES phase_definitions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_phase_runs_session_id ON session_phase_runs(session_id);

ALTER TABLE sessions ADD COLUMN phase_template_id TEXT;
ALTER TABLE sessions ADD COLUMN current_phase_ordinal INTEGER;
`;
