export const m032SessionUserStatus = /* sql */ `
ALTER TABLE sessions ADD COLUMN user_status TEXT NOT NULL DEFAULT 'wip';
`
