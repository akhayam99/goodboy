export const m234ScriptEnabled = `
ALTER TABLE project_scripts ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;
`;
