export const m086ImpactIndexes = /* sql */ `
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON telemetry_records(recorded_at);
`;
