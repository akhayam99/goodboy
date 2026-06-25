export const m003SessionProvider = /* sql */ `
ALTER TABLE sessions ADD COLUMN provider_default TEXT NOT NULL DEFAULT 'anthropic';
ALTER TABLE sessions ADD COLUMN provider_allow_override INTEGER NOT NULL DEFAULT 1;
`
