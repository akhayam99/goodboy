export const m008Permissions = /* sql */ `
CREATE TABLE IF NOT EXISTS permission_rules (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  workspace_id TEXT,
  session_id TEXT,
  pattern_tool TEXT NOT NULL,
  pattern_args_matcher TEXT,
  decision TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_permission_rules_scope ON permission_rules(scope);
CREATE INDEX IF NOT EXISTS idx_permission_rules_workspace_id ON permission_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_permission_rules_session_id ON permission_rules(session_id);

CREATE TABLE IF NOT EXISTS permission_audit_log (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool_use_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  rule_id TEXT,
  decided_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES permission_rules(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_permission_audit_session_id ON permission_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_run_id ON permission_audit_log(run_id);
`;
