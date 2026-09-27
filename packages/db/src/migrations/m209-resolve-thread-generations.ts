export const m209ResolveThreadGenerations = `
ALTER TABLE resolve_threads ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resolve_threads ADD COLUMN reopened_from_thread_id TEXT REFERENCES resolve_threads(id) ON DELETE SET NULL;
`;
