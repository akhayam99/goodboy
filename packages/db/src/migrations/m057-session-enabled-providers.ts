export const m057SessionEnabledProviders = /* sql */ `
ALTER TABLE sessions ADD COLUMN provider_enabled TEXT;
`
