export const m037PlanDiscardedStatus = /* sql */ `
-- Extend session_plans.status CHECK to include 'discarded' (soft-delete).
-- SQLite can't ALTER a CHECK constraint in place, so rebuild the table.
-- FKs OFF for the rebuild: plan_consumptions has ON DELETE CASCADE on
-- session_plans, so dropping the old table without disabling FKs would
-- wipe every consumption row.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS session_plans_new;

CREATE TABLE session_plans_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'superseded', 'discarded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

INSERT INTO session_plans_new (id, session_id, agent_id, title, body_md, status, created_at, updated_at)
  SELECT id, session_id, agent_id, title, body_md, status, created_at, updated_at
  FROM session_plans;

DROP TABLE session_plans;
ALTER TABLE session_plans_new RENAME TO session_plans;

DROP INDEX IF EXISTS idx_session_plans_session;
DROP INDEX IF EXISTS idx_session_plans_agent_id;
CREATE INDEX idx_session_plans_session ON session_plans(session_id, created_at ASC);
CREATE INDEX idx_session_plans_agent_id ON session_plans(agent_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`;
