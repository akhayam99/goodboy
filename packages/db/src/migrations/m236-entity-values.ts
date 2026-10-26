export const m236EntityValues = `
CREATE TABLE workspace_values (
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, key),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE project_values (
  project_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, key),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

INSERT INTO workspace_values (workspace_id, key, value, updated_at)
SELECT w.id, 'auto.treeLimitUsd', s.value, s.updated_at
FROM settings s
JOIN workspaces w ON s.key = 'auto.treeLimitUsd.' || w.id;

INSERT INTO workspace_values (workspace_id, key, value, updated_at)
SELECT w.id, 'terminal.workspaceFolder', s.value, s.updated_at
FROM settings s
JOIN workspaces w ON s.key = 'terminal.workspaceFolder.' || w.id;

INSERT INTO workspace_values (workspace_id, key, value, updated_at)
SELECT w.id, 'sessions.pinned', s.value, s.updated_at
FROM settings s
JOIN workspaces w ON s.key = 'sessions.pinned.' || w.id;

INSERT INTO project_values (project_id, key, value, updated_at)
SELECT p.id, 'folder.purpose', s.value, s.updated_at
FROM settings s
JOIN projects p ON s.key = 'folder.purpose.' || p.id;

INSERT INTO project_values (project_id, key, value, updated_at)
SELECT p.id, 'folder.git', s.value, s.updated_at
FROM settings s
JOIN projects p ON s.key = 'folder.git.' || p.id;

DELETE FROM settings
WHERE substr(key, 1, 18) = 'auto.treeLimitUsd.'
   OR substr(key, 1, 25) = 'terminal.workspaceFolder.'
   OR substr(key, 1, 16) = 'sessions.pinned.'
   OR substr(key, 1, 15) = 'folder.purpose.'
   OR substr(key, 1, 11) = 'folder.git.';
`;
