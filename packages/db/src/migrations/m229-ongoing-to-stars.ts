export const m229OngoingToStars = `
INSERT OR IGNORE INTO workspace_starred_issues
  (workspace_id, provider, external_id, identifier, container, title, url, state, state_label, starred_at, refreshed_at)
  SELECT workspace_id, provider, external_id, identifier, NULL, title, url, 'open', NULL, created_at, NULL
    FROM workspace_external_tasks;

DROP TABLE workspace_external_tasks;
`;
