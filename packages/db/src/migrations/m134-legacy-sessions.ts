export const m134LegacySessions = /* sql */ `
ALTER TABLE sessions ADD COLUMN legacy_at INTEGER;

UPDATE sessions SET legacy_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000;
`;
