export const m191SecurityFindings = `
CREATE TABLE IF NOT EXISTS security_findings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NULL,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('script', 'workflow-step', 'profile', 'reply-template', 'permission-rule')),
  subject_id TEXT NOT NULL,
  secret_kind TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  last4 TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  dismissed_at INTEGER NULL,
  resolved_at INTEGER NULL,
  UNIQUE (subject_kind, subject_id, fingerprint),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_security_findings_dismissed_resolved ON security_findings (dismissed_at, resolved_at);
CREATE INDEX IF NOT EXISTS idx_security_findings_workspace ON security_findings (workspace_id);
`;
