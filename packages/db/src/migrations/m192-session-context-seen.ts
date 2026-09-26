export const m192SessionContextSeen = `
ALTER TABLE sessions ADD COLUMN context_seen_at INTEGER;
`;
