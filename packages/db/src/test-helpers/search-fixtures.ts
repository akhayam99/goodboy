import type { Database } from '../client';

export const SEARCH_WORLD = {
  workspaceId: 'ws-harborline',
  otherWorkspaceId: 'ws-northwind',
  projectId: 'proj-ledger-core',
  otherProjectId: 'proj-notify-relay',
  sessionId: 's-payout',
  otherSessionId: 's-relay',
  agentId: 'a-builder',
  otherAgentId: 'a-relay',
  runId: 'run-codex',
  mountId: 'm-ledger',
  day: 86_400_000,
  now: Date.UTC(2026, 8, 27, 12),
} as const;

type SeedParams = {
  readonly db: Database;
};

export const seedSearchWorld = async ({ db }: SeedParams): Promise<void> => {
  const w = SEARCH_WORLD;
  const at = w.now - 10 * w.day;
  await db.exec(`
INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES
  ('${w.workspaceId}', 'Harborline', 'harborline', ${at}, ${at}),
  ('${w.otherWorkspaceId}', 'Northwind', 'northwind', ${at}, ${at});
INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES
  ('${w.projectId}', '${w.workspaceId}', 'ledger-core', '/code/ledger-core', 'repo', ${at}, ${at}),
  ('${w.otherProjectId}', '${w.otherWorkspaceId}', 'notify-relay', '/code/notify-relay', 'repo', ${at}, ${at});
INSERT INTO sessions (id, workspace_id, goal, state_kind, active_project_id, created_at, updated_at) VALUES
  ('${w.sessionId}', '${w.workspaceId}', 'Speed up the payout export for large merchants', 'idle', '${w.projectId}', ${at}, ${at}),
  ('${w.otherSessionId}', '${w.otherWorkspaceId}', 'Retry relay webhooks', 'running', '${w.otherProjectId}', ${w.now - w.day}, ${w.now - w.day});
INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at) VALUES
  ('${w.runId}', '${w.sessionId}', 'codex', 'gpt-6', 'succeeded', ${at});
INSERT INTO agents (id, session_id, ordinal, name, status, provider_run_id, output_summary, started_at) VALUES
  ('${w.agentId}', '${w.sessionId}', 1, 'Payout builder', 'idle', '${w.runId}', 'Streams the export in batches', ${at}),
  ('${w.otherAgentId}', '${w.otherSessionId}', 1, 'Relay fixer', 'running', NULL, NULL, ${w.now - w.day});
INSERT INTO messages (id, session_id, agent_id, role, content, created_at) VALUES
  ('msg-user', '${w.sessionId}', '${w.agentId}', 'user', 'The settlement export times out for Maya Lindqvist', ${at}),
  ('msg-assistant', '${w.sessionId}', '${w.agentId}', 'assistant', 'I streamed the settlement rows in pages of 500', ${at + 1000}),
  ('msg-system', '${w.sessionId}', '${w.agentId}', 'system', 'settlement tool output that stays private', ${at + 2000}),
  ('msg-relay', '${w.otherSessionId}', '${w.otherAgentId}', 'user', 'Retry the settlement webhook for Tomas Ferreira', ${w.now - w.day});
INSERT INTO session_artifacts (id, session_id, agent_id, kind, schema_version, title, source_format, source_text, metadata_json, status, revision, created_at, updated_at) VALUES
  ('art-plan', '${w.sessionId}', '${w.agentId}', 'plan', 1, 'Payout export plan', 'markdown', '# Stream settlement rows\\n\\nPage through the ledger.', '{}', 'active', 1, ${at}, ${at}),
  ('art-wire', '${w.sessionId}', '${w.agentId}', 'wireframe', 1, 'Export screen', 'json', '{"screens":[{"title":"hidden json settlement"}]}', '{}', 'active', 1, ${at}, ${at});
INSERT INTO session_decisions (id, session_id, number, text, why, status, author, created_at, updated_at) VALUES
  ('dec-1', '${w.sessionId}', 1, 'Page settlement rows by 500', 'Large merchants time out', 'active', 'agent', ${at}, ${at});
INSERT INTO open_questions (id, session_id, text, user_answer, status, created_at) VALUES
  ('q-1', '${w.sessionId}', 'Which merchants are large?', 'Over ten thousand payouts', 'answered', ${at});
INSERT INTO session_external_tasks (session_id, provider, external_id, identifier, url, title, created_at) VALUES
  ('${w.sessionId}', 'linear', 'lin-231', 'HAR-231', 'https://linear.app/harborline/issue/HAR-231', 'Payout export times out', ${at});
INSERT INTO workspace_starred_issues (workspace_id, provider, external_id, identifier, container, title, url, state, starred_at) VALUES
  ('${w.workspaceId}', 'jira', 'jira-88', 'NW-88', 'Payments', 'Settlement drift in ledger', 'https://jira.example/NW-88', 'open', ${at});
INSERT INTO session_worktrees (id, session_id, branch, project_id, repo_slug, mount_name, created_at) VALUES
  ('${w.mountId}', '${w.sessionId}', 'ak/feat-payout-stream', '${w.projectId}', 'harborline/ledger-core', 'ledger-core', ${at});
INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at) VALUES
  ('ak/feat-payout-stream', 'harborline/ledger-core', '{"number":482,"title":"Stream the payout export","url":"https://github.com/harborline/ledger-core/pull/482","state":"open","updatedAt":"2026-09-20T10:00:00.000Z"}', ${at});
INSERT INTO workflows (id, workspace_id, name, description, goal, is_preset, created_at, updated_at) VALUES
  ('wf-settle', '${w.workspaceId}', 'Settlement hardening', 'Harden the settlement export', NULL, 1, ${at}, ${at});
INSERT INTO steps (id, workflow_id, ordinal, name, expected_output) VALUES
  ('step-scout', 'wf-settle', 0, 'Scout the ledger rounding', 'A map of the rounding paths');
INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at) VALUES
  ('c-1', '${w.sessionId}', 'src/export/stream.ts', 'Page size should come from the merchant tier', 'open', ${at});
INSERT INTO mount_pr_links (id, mount_id, provider, host, repo_slug, pr_number, head_branch, url, state, snapshot_json, last_observed_at, created_at, updated_at) VALUES
  ('mpr-1', '${w.mountId}', 'gitlab', 'gitlab.example', 'harborline/ledger-core', 17, 'ak/feat-payout-stream', 'https://gitlab.example/mr/17', 'open', '{"title":"Payout stream merge request"}', ${at}, ${at}, ${at});
`);
};
