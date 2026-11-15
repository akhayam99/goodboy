export const m243LeadPermissions = `
ALTER TABLE auto_trees ADD COLUMN permissions TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(permissions));

ALTER TABLE auto_attempts ADD COLUMN launch_snapshot TEXT CHECK (launch_snapshot IS NULL OR json_valid(launch_snapshot));

CREATE TABLE auto_grants (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES auto_trees(id) ON DELETE CASCADE,
  delegation_id TEXT REFERENCES auto_delegations(id) ON DELETE CASCADE,
  attempt_id TEXT REFERENCES auto_attempts(id) ON DELETE CASCADE,
  text_version TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('dependency', 'protected_file', 'pull_request')),
  subject TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'asked' CHECK (state IN ('asked', 'allowed', 'declined', 'used')),
  answered_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((attempt_id IS NULL) <> (text_version IS NULL)),
  CHECK ((kind = 'pull_request') = (text_version IS NOT NULL)),
  CHECK ((state = 'asked') = (answered_at IS NULL))
);

CREATE INDEX idx_auto_grants_tree ON auto_grants(tree_id, state);
CREATE INDEX idx_auto_grants_delegation ON auto_grants(delegation_id) WHERE delegation_id IS NOT NULL;
CREATE UNIQUE INDEX idx_auto_grants_attempt
  ON auto_grants(attempt_id, kind, subject) WHERE attempt_id IS NOT NULL;
CREATE UNIQUE INDEX idx_auto_grants_text
  ON auto_grants(tree_id, subject, text_version) WHERE text_version IS NOT NULL;
`;
