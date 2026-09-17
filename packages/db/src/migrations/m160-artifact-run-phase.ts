export const m160ArtifactRunPhase = /* sql */ `
ALTER TABLE artifact_provenance ADD COLUMN phase TEXT NOT NULL DEFAULT 'done' CHECK (phase IN ('gathering', 'producing', 'done', 'failed'));
ALTER TABLE artifact_provenance ADD COLUMN scout_plan_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(scout_plan_json) AND json_type(scout_plan_json) = 'array');
ALTER TABLE artifact_provenance ADD COLUMN mount_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(mount_ids_json) AND json_type(mount_ids_json) = 'array');
ALTER TABLE artifact_provenance ADD COLUMN target TEXT;
ALTER TABLE artifact_provenance ADD COLUMN deadline_at INTEGER;
`;
