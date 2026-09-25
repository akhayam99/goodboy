export const m174AgentStopped = `
ALTER TABLE agents ADD COLUMN stopped_at INTEGER;
ALTER TABLE agents ADD COLUMN stopped_by TEXT;
`;
