export const m197ArtifactRevisions = `
CREATE TABLE IF NOT EXISTS artifact_revisions (
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  title TEXT NOT NULL,
  source_text TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json) AND json_type(metadata_json) = 'object'),
  author TEXT NOT NULL CHECK (author IN ('agent', 'user', 'import', 'restore')),
  ask TEXT,
  pinned_json TEXT CHECK (pinned_json IS NULL OR json_valid(pinned_json)),
  summary_json TEXT CHECK (summary_json IS NULL OR json_valid(summary_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, revision),
  FOREIGN KEY (artifact_id) REFERENCES session_artifacts(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO artifact_revisions (
  artifact_id, revision, title, source_text, metadata_json, author, created_at
)
SELECT id, revision, title, source_text, metadata_json, 'agent', updated_at
FROM session_artifacts;

DROP TABLE IF EXISTS artifact_renditions;
`;
