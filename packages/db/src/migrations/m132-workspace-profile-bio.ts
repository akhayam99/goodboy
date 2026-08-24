export const m132WorkspaceProfileBio = /* sql */ `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS workspace_profiles_new;

CREATE TABLE workspace_profiles_new (
  workspace_id TEXT PRIMARY KEY,
  bio TEXT,
  updated_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO workspace_profiles_new (workspace_id, bio, updated_at)
  SELECT
    workspace_id,
    NULLIF(TRIM(
      CASE role
        WHEN 'developer' THEN 'I write code. '
        WHEN 'non-developer' THEN 'I do not write code. '
        ELSE ''
      END
      || CASE
        WHEN discipline IS NOT NULL AND TRIM(discipline) <> ''
          THEN 'My work is closest to ' || TRIM(discipline) || '. '
        ELSE ''
      END
      || CASE
        WHEN topics IS NOT NULL AND json_valid(topics) AND json_array_length(topics) > 0
          THEN 'I care about ' || (SELECT group_concat(value, ', ') FROM json_each(topics)) || '. '
        ELSE ''
      END
      || COALESCE(TRIM(notes), '')
    ), '') AS bio,
    updated_at
  FROM workspace_profiles;

DROP TABLE workspace_profiles;
ALTER TABLE workspace_profiles_new RENAME TO workspace_profiles;

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
