export const m118WorkspaceContainers = /* sql */ `
PRAGMA foreign_keys = OFF;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sessions_root TEXT,
  default_provider_id TEXT,
  default_workflow_id TEXT,
  default_branch_prefix TEXT,
  parallel_enabled INTEGER CHECK (parallel_enabled IN (0, 1)),
  default_verbosity TEXT CHECK (default_verbosity IN ('brief', 'normal', 'verbose')),
  provider_bindings TEXT,
  task_models TEXT,
  role_models TEXT,
  scout_fanout INTEGER,
  provider_pool TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  disconnected_at INTEGER,
  last_accessed_at INTEGER
);

ALTER TABLE projects ADD COLUMN workspace_id TEXT;

UPDATE projects
SET workspace_id = (
  SELECT candidate.composite_workspace_id
  FROM workspace_members candidate
  JOIN projects composite ON composite.id = candidate.composite_workspace_id
  WHERE candidate.member_workspace_id = projects.id
    AND composite.kind = 'composite'
    AND composite.disconnected_at IS NULL
  ORDER BY composite.last_accessed_at DESC, composite.id
  LIMIT 1
)
WHERE kind <> 'composite'
  AND EXISTS (
    SELECT 1
    FROM workspace_members candidate
    JOIN projects composite ON composite.id = candidate.composite_workspace_id
    WHERE candidate.member_workspace_id = projects.id
      AND composite.kind = 'composite'
      AND composite.disconnected_at IS NULL
  );

UPDATE projects
SET workspace_id = lower(
  hex(randomblob(4)) || '-' ||
  hex(randomblob(2)) || '-' ||
  hex(randomblob(2)) || '-' ||
  hex(randomblob(2)) || '-' ||
  hex(randomblob(6))
)
WHERE kind <> 'composite'
  AND workspace_id IS NULL;

CREATE TABLE workspace_backfill (
  workspace_id TEXT PRIMARY KEY,
  source_project_id TEXT NOT NULL UNIQUE,
  base_slug TEXT NOT NULL,
  slug_order INTEGER NOT NULL
);

WITH RECURSIVE
sources(source_project_id, workspace_id, name, slug_order) AS (
  SELECT
    id,
    CASE WHEN kind = 'composite' THEN id ELSE workspace_id END,
    name,
    CASE WHEN kind = 'composite' THEN 0 ELSE 1 END
  FROM projects
  WHERE (kind = 'composite' AND disconnected_at IS NULL)
     OR (
       kind <> 'composite'
       AND NOT EXISTS (
         SELECT 1
         FROM projects composite
         WHERE composite.id = projects.workspace_id
           AND composite.kind = 'composite'
           AND composite.disconnected_at IS NULL
       )
     )
),
slugs(source_project_id, workspace_id, name, slug_order, position, slug) AS (
  SELECT source_project_id, workspace_id, name, slug_order, 1, ''
  FROM sources
  UNION ALL
  SELECT
    source_project_id,
    workspace_id,
    name,
    slug_order,
    position + 1,
    CASE
      WHEN instr('abcdefghijklmnopqrstuvwxyz0123456789', lower(substr(name, position, 1))) > 0
        THEN slug || lower(substr(name, position, 1))
      WHEN length(slug) = 0 OR substr(slug, -1) = '-'
        THEN slug
      ELSE slug || '-'
    END
  FROM slugs
  WHERE position <= length(name)
)
INSERT INTO workspace_backfill (workspace_id, source_project_id, base_slug, slug_order)
SELECT
  workspace_id,
  source_project_id,
  COALESCE(NULLIF(rtrim(slug, '-'), ''), 'workspace'),
  slug_order
FROM slugs
WHERE position = length(name) + 1;

WITH RECURSIVE
numbers(value) AS (
  SELECT 2
  UNION ALL
  SELECT value + 1
  FROM numbers
  WHERE value < (SELECT COUNT(*) + 1 FROM workspace_backfill)
),
ranked AS (
  SELECT
    workspace_id,
    base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY base_slug
      ORDER BY slug_order, source_project_id
    ) AS duplicate_rank
  FROM workspace_backfill
),
available AS (
  SELECT
    ranked.workspace_id,
    numbers.value,
    ROW_NUMBER() OVER (
      PARTITION BY ranked.workspace_id
      ORDER BY numbers.value
    ) AS available_rank
  FROM ranked
  CROSS JOIN numbers
  WHERE ranked.duplicate_rank > 1
    AND NOT EXISTS (
      SELECT 1
      FROM workspace_backfill blocked
      WHERE blocked.base_slug = ranked.base_slug || '-' || numbers.value
    )
),
resolved AS (
  SELECT workspace_id, base_slug AS slug
  FROM ranked
  WHERE duplicate_rank = 1
  UNION ALL
  SELECT ranked.workspace_id, ranked.base_slug || '-' || available.value
  FROM ranked
  JOIN available ON available.workspace_id = ranked.workspace_id
  WHERE ranked.duplicate_rank > 1
    AND available.available_rank = ranked.duplicate_rank - 1
)
INSERT INTO workspaces (
  id,
  name,
  slug,
  sessions_root,
  default_provider_id,
  default_workflow_id,
  default_branch_prefix,
  parallel_enabled,
  default_verbosity,
  provider_bindings,
  task_models,
  role_models,
  scout_fanout,
  provider_pool,
  created_at,
  updated_at,
  deleted_at,
  disconnected_at,
  last_accessed_at
)
SELECT
  workspace_backfill.workspace_id,
  projects.name,
  resolved.slug,
  NULL,
  projects.default_provider_id,
  projects.default_workflow_id,
  projects.default_branch_prefix,
  projects.parallel_enabled,
  projects.default_verbosity,
  projects.provider_bindings,
  projects.task_models,
  projects.role_models,
  projects.scout_fanout,
  projects.provider_pool,
  projects.created_at,
  projects.updated_at,
  projects.deleted_at,
  projects.disconnected_at,
  projects.last_accessed_at
FROM workspace_backfill
JOIN projects ON projects.id = workspace_backfill.source_project_id
JOIN resolved ON resolved.workspace_id = workspace_backfill.workspace_id;

CREATE TABLE project_scope_backfill (
  old_project_id TEXT PRIMARY KEY,
  new_workspace_id TEXT NOT NULL,
  absorbed_project_id TEXT
);

INSERT INTO project_scope_backfill (
  old_project_id,
  new_workspace_id,
  absorbed_project_id
)
SELECT
  project.id,
  CASE
    WHEN project.kind = 'composite' AND project.disconnected_at IS NULL THEN project.id
    WHEN project.kind = 'composite' THEN (
      SELECT member.workspace_id
      FROM workspace_members
      JOIN projects member ON member.id = workspace_members.member_workspace_id
      WHERE workspace_members.composite_workspace_id = project.id
      ORDER BY workspace_members.sort_order, workspace_members.id
      LIMIT 1
    )
    ELSE project.workspace_id
  END,
  CASE
    WHEN project.kind <> 'composite'
      AND EXISTS (
        SELECT 1
        FROM projects composite
        WHERE composite.id = project.workspace_id
          AND composite.kind = 'composite'
          AND composite.disconnected_at IS NULL
      )
      THEN project.id
    ELSE NULL
  END
FROM projects project;

CREATE TABLE workflow_name_backfill (
  old_workflow_id TEXT PRIMARY KEY,
  new_name TEXT NOT NULL
);

WITH RECURSIVE
numbers(value) AS (
  SELECT 2
  UNION ALL
  SELECT value + 1
  FROM numbers
  WHERE value < (SELECT COUNT(*) + 1 FROM workflows WHERE deleted_at IS NULL)
),
ranked_live AS (
  SELECT
    workflows.id,
    workflows.name,
    project_scope_backfill.new_workspace_id,
    ROW_NUMBER() OVER (
      PARTITION BY project_scope_backfill.new_workspace_id, workflows.name
      ORDER BY workflows.updated_at DESC, workflows.rowid DESC
    ) AS duplicate_rank
  FROM workflows
  JOIN project_scope_backfill
    ON project_scope_backfill.old_project_id = workflows.workspace_id
  WHERE workflows.deleted_at IS NULL
),
colliding_names AS (
  SELECT DISTINCT new_workspace_id, name
  FROM ranked_live
  WHERE duplicate_rank > 1
),
available_names AS (
  SELECT
    colliding_names.new_workspace_id,
    colliding_names.name,
    numbers.value,
    ROW_NUMBER() OVER (
      PARTITION BY colliding_names.new_workspace_id, colliding_names.name
      ORDER BY numbers.value
    ) AS available_rank
  FROM colliding_names
  CROSS JOIN numbers
  WHERE NOT EXISTS (
    SELECT 1
    FROM ranked_live blocked
    WHERE blocked.new_workspace_id = colliding_names.new_workspace_id
      AND blocked.name = colliding_names.name || ' ' || numbers.value
  )
)
INSERT INTO workflow_name_backfill (old_workflow_id, new_name)
SELECT
  ranked_live.id,
  ranked_live.name || ' ' || available_names.value
FROM ranked_live
JOIN available_names
  ON available_names.new_workspace_id = ranked_live.new_workspace_id
  AND available_names.name = ranked_live.name
  AND available_names.available_rank = ranked_live.duplicate_rank - 1
WHERE ranked_live.duplicate_rank > 1;

DROP TABLE IF EXISTS workflows_new;
CREATE TABLE workflows_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  is_preset INTEGER NOT NULL DEFAULT 1,
  goal TEXT,
  process_text TEXT,
  origin TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO workflows_new (
  id,
  workspace_id,
  name,
  description,
  created_at,
  updated_at,
  deleted_at,
  is_preset,
  goal,
  process_text,
  origin
)
SELECT
  workflows.id,
  project_scope_backfill.new_workspace_id,
  COALESCE(workflow_name_backfill.new_name, workflows.name),
  workflows.description,
  workflows.created_at,
  workflows.updated_at,
  workflows.deleted_at,
  workflows.is_preset,
  workflows.goal,
  workflows.process_text,
  workflows.origin
FROM workflows
JOIN project_scope_backfill
  ON project_scope_backfill.old_project_id = workflows.workspace_id
LEFT JOIN workflow_name_backfill
  ON workflow_name_backfill.old_workflow_id = workflows.id;

DROP TABLE workflows;
ALTER TABLE workflows_new RENAME TO workflows;
DROP TABLE workflow_name_backfill;

CREATE UNIQUE INDEX idx_workflows_workspace_name_live
  ON workflows(workspace_id, name)
  WHERE deleted_at IS NULL;

DROP TABLE IF EXISTS step_library_new;
CREATE TABLE step_library_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  base_step_id TEXT,
  role TEXT NOT NULL DEFAULT 'custom',
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_default TEXT,
  model_default TEXT,
  effort_default TEXT,
  verbosity_default TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (base_step_id) REFERENCES step_library(id) ON DELETE SET NULL
);

INSERT INTO step_library_new (
  id,
  workspace_id,
  base_step_id,
  role,
  name,
  prompt_prefix,
  provider_default,
  model_default,
  effort_default,
  verbosity_default,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  step_library.id,
  CASE
    WHEN step_library.workspace_id IS NULL THEN NULL
    ELSE project_scope_backfill.new_workspace_id
  END,
  step_library.base_step_id,
  step_library.role,
  step_library.name,
  step_library.prompt_prefix,
  step_library.provider_default,
  step_library.model_default,
  step_library.effort_default,
  step_library.verbosity_default,
  step_library.created_at,
  step_library.updated_at,
  step_library.deleted_at
FROM step_library
LEFT JOIN project_scope_backfill
  ON project_scope_backfill.old_project_id = step_library.workspace_id;

DROP TABLE step_library;
ALTER TABLE step_library_new RENAME TO step_library;

CREATE INDEX idx_step_library_workspace ON step_library(workspace_id);
CREATE INDEX idx_step_library_base
  ON step_library(base_step_id)
  WHERE base_step_id IS NOT NULL;

DROP TABLE IF EXISTS skills_new;
CREATE TABLE skills_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, name)
);

WITH ranked_skills AS (
  SELECT
    skills.id,
    project_scope_backfill.new_workspace_id,
    skills.name,
    skills.description,
    skills.file_path,
    skills.body,
    skills.frontmatter_json,
    skills.created_at,
    skills.updated_at,
    skills.deleted_at,
    ROW_NUMBER() OVER (
      PARTITION BY project_scope_backfill.new_workspace_id, skills.name
      ORDER BY skills.updated_at DESC, skills.id
    ) AS preference
  FROM skills
  JOIN project_scope_backfill
    ON project_scope_backfill.old_project_id = skills.workspace_id
)
INSERT INTO skills_new (
  id,
  workspace_id,
  name,
  description,
  file_path,
  body,
  frontmatter_json,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  id,
  new_workspace_id,
  name,
  description,
  file_path,
  body,
  frontmatter_json,
  created_at,
  updated_at,
  deleted_at
FROM ranked_skills
WHERE preference = 1;

DROP TABLE skills;
ALTER TABLE skills_new RENAME TO skills;

CREATE INDEX idx_skills_workspace_id ON skills(workspace_id);

DROP TABLE IF EXISTS notifications_new;
CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  session_id TEXT,
  workspace_id TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  action TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

INSERT INTO notifications_new (
  id,
  ts,
  kind,
  title,
  body,
  severity,
  session_id,
  workspace_id,
  read,
  action
)
SELECT
  notifications.id,
  notifications.ts,
  notifications.kind,
  notifications.title,
  notifications.body,
  notifications.severity,
  notifications.session_id,
  CASE
    WHEN notifications.workspace_id IS NULL THEN NULL
    ELSE project_scope_backfill.new_workspace_id
  END,
  notifications.read,
  notifications.action
FROM notifications
LEFT JOIN project_scope_backfill
  ON project_scope_backfill.old_project_id = notifications.workspace_id;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX idx_notifications_unread
  ON notifications(ts DESC)
  WHERE read = 0;
CREATE INDEX idx_notifications_session_id
  ON notifications(session_id)
  WHERE session_id IS NOT NULL;
CREATE INDEX idx_notifications_workspace_id
  ON notifications(workspace_id)
  WHERE workspace_id IS NOT NULL;

DROP TABLE IF EXISTS permission_rules_new;
CREATE TABLE permission_rules_new (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('workspace','project','session','global')),
  workspace_id TEXT,
  project_id TEXT,
  session_id TEXT,
  pattern_tool TEXT NOT NULL,
  pattern_args_matcher TEXT,
  decision TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO permission_rules_new (
  id,
  scope,
  workspace_id,
  project_id,
  session_id,
  pattern_tool,
  pattern_args_matcher,
  decision,
  priority,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  permission_rules.id,
  CASE
    WHEN permission_rules.scope = 'workspace'
      AND project_scope_backfill.absorbed_project_id IS NOT NULL
      THEN 'project'
    ELSE permission_rules.scope
  END,
  CASE
    WHEN permission_rules.workspace_id IS NULL THEN NULL
    ELSE project_scope_backfill.new_workspace_id
  END,
  CASE
    WHEN permission_rules.scope = 'workspace'
      THEN project_scope_backfill.absorbed_project_id
    ELSE NULL
  END,
  permission_rules.session_id,
  permission_rules.pattern_tool,
  permission_rules.pattern_args_matcher,
  permission_rules.decision,
  permission_rules.priority,
  permission_rules.created_at,
  permission_rules.updated_at,
  permission_rules.deleted_at
FROM permission_rules
LEFT JOIN project_scope_backfill
  ON project_scope_backfill.old_project_id = permission_rules.workspace_id;

DROP TABLE permission_rules;
ALTER TABLE permission_rules_new RENAME TO permission_rules;

CREATE INDEX idx_permission_rules_scope ON permission_rules(scope);
CREATE INDEX idx_permission_rules_workspace_id ON permission_rules(workspace_id);
CREATE INDEX idx_permission_rules_project_id ON permission_rules(project_id);
CREATE INDEX idx_permission_rules_session_id ON permission_rules(session_id);

ALTER TABLE workspace_scripts RENAME TO project_scripts;
ALTER TABLE project_scripts RENAME COLUMN workspace_id TO project_id;
DROP INDEX IF EXISTS idx_workspace_scripts_workspace;
CREATE INDEX idx_project_scripts_project ON project_scripts(project_id, sort_order);

UPDATE session_worktrees
SET mount_workspace_id = (
  SELECT sessions.workspace_id
  FROM sessions
  JOIN projects ON projects.id = sessions.workspace_id
  WHERE sessions.id = session_worktrees.session_id
    AND projects.kind <> 'composite'
)
WHERE mount_workspace_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM sessions
    JOIN projects ON projects.id = sessions.workspace_id
    WHERE sessions.id = session_worktrees.session_id
      AND projects.kind <> 'composite'
  );

UPDATE sessions
SET workspace_id = (
  SELECT projects.workspace_id
  FROM projects
  WHERE projects.id = sessions.workspace_id
)
WHERE EXISTS (
  SELECT 1
  FROM projects
  WHERE projects.id = sessions.workspace_id
    AND projects.kind <> 'composite'
);

UPDATE sessions
SET workspace_id = (
  SELECT member.workspace_id
  FROM workspace_members
  JOIN projects member ON member.id = workspace_members.member_workspace_id
  WHERE workspace_members.composite_workspace_id = sessions.workspace_id
  ORDER BY workspace_members.sort_order, workspace_members.id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM projects composite
  WHERE composite.id = sessions.workspace_id
    AND composite.kind = 'composite'
    AND composite.disconnected_at IS NOT NULL
);

CREATE TABLE workspace_setting_backfill (
  source_key TEXT PRIMARY KEY,
  target_key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  priority INTEGER NOT NULL
);

WITH project_workspace_map(old_project_id, new_workspace_id, priority) AS (
  SELECT
    project.id,
    CASE
      WHEN project.kind = 'composite' AND project.disconnected_at IS NULL THEN project.id
      WHEN project.kind = 'composite' THEN (
        SELECT member.workspace_id
        FROM workspace_members
        JOIN projects member ON member.id = workspace_members.member_workspace_id
        WHERE workspace_members.composite_workspace_id = project.id
        ORDER BY workspace_members.sort_order, workspace_members.id
        LIMIT 1
      )
      ELSE project.workspace_id
    END,
    CASE
      WHEN project.kind = 'composite' AND project.disconnected_at IS NULL THEN 0
      ELSE 1
    END
  FROM projects project
)
INSERT INTO workspace_setting_backfill (source_key, target_key, value, updated_at, priority)
SELECT
  settings.key,
  'workspace.' || project_workspace_map.new_workspace_id || '.branch_prefix',
  settings.value,
  settings.updated_at,
  project_workspace_map.priority
FROM settings
JOIN project_workspace_map
  ON settings.key = 'workspace.' || project_workspace_map.old_project_id || '.branch_prefix'
WHERE project_workspace_map.new_workspace_id IS NOT NULL;

DELETE FROM settings
WHERE key IN (SELECT source_key FROM workspace_setting_backfill);

INSERT OR REPLACE INTO settings (key, value, updated_at)
SELECT target_key, value, updated_at
FROM (
  SELECT
    target_key,
    value,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY target_key
      ORDER BY priority, updated_at DESC, source_key
    ) AS preference
  FROM workspace_setting_backfill
)
WHERE preference = 1;

DELETE FROM settings
WHERE key LIKE 'workspace.%.agent_title_mode';

DELETE FROM projects
WHERE kind = 'composite';

DROP TABLE workspace_members;
DROP TABLE workspace_setting_backfill;
DROP TABLE workspace_backfill;
DROP TABLE project_scope_backfill;

PRAGMA foreign_keys = ON;
`;
