export const m201ProjectIdentity = `
ALTER TABLE projects ADD COLUMN root_commit TEXT;
ALTER TABLE projects ADD COLUMN remote_url TEXT;
ALTER TABLE projects ADD COLUMN identity_checked_at INTEGER;
`;
