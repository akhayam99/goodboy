export const m029AgentUnread = /* sql */ `
ALTER TABLE sessions ADD COLUMN last_finished_at TEXT;
ALTER TABLE sessions ADD COLUMN last_viewed_at TEXT;
`
