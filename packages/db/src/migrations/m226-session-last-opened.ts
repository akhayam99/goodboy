export const m226SessionLastOpened = `
ALTER TABLE sessions ADD COLUMN last_opened_at INTEGER;
`;
