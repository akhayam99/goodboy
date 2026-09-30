export const m215IndexAudit = `
DROP INDEX IF EXISTS idx_agents_session_id;
DROP INDEX IF EXISTS idx_mount_operations_session_id;
DROP INDEX IF EXISTS idx_mount_pr_links_mount_id;
DROP INDEX IF EXISTS idx_permission_audit_session_id;
DROP INDEX IF EXISTS idx_pr_series_session_id;
DROP INDEX IF EXISTS idx_security_findings_workspace;
DROP INDEX IF EXISTS idx_session_artifacts_agent_id;
DROP INDEX IF EXISTS idx_session_worktrees_session_id;
DROP INDEX IF EXISTS idx_skills_workspace_id;

CREATE INDEX IF NOT EXISTS idx_deleted_branches_workspace_id ON deleted_branches (workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_bindings_project_id ON integration_bindings (project_id);
CREATE INDEX IF NOT EXISTS idx_open_questions_answered_by_agent_id ON open_questions (answered_by_agent_id);
CREATE INDEX IF NOT EXISTS idx_resolve_threads_reopened_from_thread_id ON resolve_threads (reopened_from_thread_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_project_id ON security_findings (project_id);
CREATE INDEX IF NOT EXISTS idx_steps_library_step_id ON steps (library_step_id);
`;
