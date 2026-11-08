export const m240TurnAdmissions = `
CREATE TABLE turn_admissions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  owner_launch TEXT,
  claimed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (agent_id)
);
`;
