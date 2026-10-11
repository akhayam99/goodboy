export const m228RetireProjectModels = `
INSERT OR REPLACE INTO settings (key, value, updated_at)
  SELECT
    'legacy.projectModels.' || id,
    json_object(
      'taskModels',
      json(CASE WHEN task_models IS NOT NULL AND json_valid(task_models) THEN task_models ELSE 'null' END),
      'roleModels',
      json(CASE WHEN role_models IS NOT NULL AND json_valid(role_models) THEN role_models ELSE 'null' END)
    ),
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM projects
  WHERE (task_models IS NOT NULL AND json_valid(task_models) AND json(task_models) <> 'null')
    OR (role_models IS NOT NULL AND json_valid(role_models) AND json(role_models) <> 'null');

UPDATE projects SET task_models = NULL, role_models = NULL
  WHERE task_models IS NOT NULL OR role_models IS NOT NULL;
`;
