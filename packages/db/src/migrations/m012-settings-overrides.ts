export const m012SettingsOverrides = /* sql */ `
ALTER TABLE workspaces ADD COLUMN default_provider_id TEXT;
ALTER TABLE workspaces ADD COLUMN default_phase_template_id TEXT;
ALTER TABLE workspaces ADD COLUMN default_branch_prefix TEXT;
ALTER TABLE workspaces ADD COLUMN parallel_enabled INTEGER CHECK (parallel_enabled IN (0, 1));

ALTER TABLE sessions ADD COLUMN default_provider_id TEXT;
ALTER TABLE sessions ADD COLUMN default_phase_template_id TEXT;
ALTER TABLE sessions ADD COLUMN default_branch_prefix TEXT;
ALTER TABLE sessions ADD COLUMN parallel_enabled INTEGER CHECK (parallel_enabled IN (0, 1));
`
