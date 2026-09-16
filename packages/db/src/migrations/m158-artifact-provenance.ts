export const m158ArtifactProvenance = /* sql */ `
CREATE TABLE IF NOT EXISTS artifact_provenance (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'report', 'wireframe')),
  brief TEXT,
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json) AND json_type(evidence_json) = 'array'),
  omissions_json TEXT NOT NULL CHECK (json_valid(omissions_json) AND json_type(omissions_json) = 'array'),
  design_profile_summary TEXT,
  source_workflow_run_id TEXT REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  executing_workflow_run_id TEXT REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_provenance_session
  ON artifact_provenance(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_artifact_provenance_source_run
  ON artifact_provenance(source_workflow_run_id)
  WHERE source_workflow_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artifact_provenance_executing_run
  ON artifact_provenance(executing_workflow_run_id)
  WHERE executing_workflow_run_id IS NOT NULL;

PRAGMA foreign_key_check(artifact_provenance);
`;
