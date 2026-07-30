export const m089TelemetryCacheTokens = `
ALTER TABLE telemetry_records ADD COLUMN cached_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_records ADD COLUMN cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0;
`;
