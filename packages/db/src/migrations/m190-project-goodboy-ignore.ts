export const m190ProjectGoodboyIgnore = `
ALTER TABLE projects ADD COLUMN goodboy_ignore TEXT CHECK (goodboy_ignore IN ('existing', 'this-mac', 'project', 'global'));
ALTER TABLE projects ADD COLUMN goodboy_ignore_source TEXT;
ALTER TABLE projects ADD COLUMN goodboy_ignore_checked_at INTEGER;
`;
