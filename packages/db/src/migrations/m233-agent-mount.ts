export const m233AgentMount = `
ALTER TABLE agents ADD COLUMN mount_id TEXT REFERENCES session_worktrees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agents_mount_id ON agents(mount_id) WHERE mount_id IS NOT NULL;
`;
