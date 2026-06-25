export const m022TaskAutorun = /* sql */ `
ALTER TABLE tasks ADD COLUMN auto_run INTEGER NOT NULL DEFAULT 0;
`
