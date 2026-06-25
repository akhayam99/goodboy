export const m004TurnOverrides = /* sql */ `
ALTER TABLE messages ADD COLUMN provider_override_id TEXT NULL;
ALTER TABLE messages ADD COLUMN provider_override_model TEXT NULL;
`
