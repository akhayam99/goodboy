export const m156LiveAgentsView = /* sql */ `
CREATE VIEW IF NOT EXISTS live_agents AS SELECT * FROM agents WHERE deleted_at IS NULL;
`;
