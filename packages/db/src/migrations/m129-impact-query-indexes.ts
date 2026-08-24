export const m129ImpactQueryIndexes = /* sql */ `
CREATE INDEX idx_permission_audit_session_requested_at
  ON permission_audit_log(session_id, requested_at);

CREATE INDEX idx_notifications_ts ON notifications(ts);
CREATE INDEX idx_telemetry_provider ON telemetry_records(provider);
CREATE INDEX idx_diff_comments_session_created_at ON diff_comments(session_id, created_at);

CREATE INDEX idx_skills_workspace_created_at ON skills(workspace_id, created_at);

DROP INDEX IF EXISTS idx_github_pr_cache_branch;
`;
