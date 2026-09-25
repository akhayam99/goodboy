export const m178WorkspaceProfileFields = `
ALTER TABLE workspace_profiles ADD COLUMN roles_json TEXT;
ALTER TABLE workspace_profiles ADD COLUMN about_work TEXT;
ALTER TABLE workspace_profiles ADD COLUMN working_rules TEXT;
ALTER TABLE workspace_profiles ADD COLUMN explain_more_json TEXT;

UPDATE workspace_profiles
SET about_work = NULLIF(TRIM(bio), '')
WHERE about_work IS NULL AND bio IS NOT NULL;
`;
