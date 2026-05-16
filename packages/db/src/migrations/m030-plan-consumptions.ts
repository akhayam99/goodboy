export const m030PlanConsumptions = /* sql */ `
CREATE TABLE IF NOT EXISTS session_plans (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'superseded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, agent_id),
  FOREIGN KEY (session_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES sessions(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS session_plans_new;

CREATE TABLE session_plans_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'superseded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO session_plans_new (id, session_id, agent_id, title, body_md, status, created_at, updated_at)
  SELECT id, session_id, agent_id, title, body_md,
         CASE WHEN status = 'completed' THEN 'consumed' ELSE status END,
         created_at, updated_at
  FROM session_plans;

DROP TABLE session_plans;
ALTER TABLE session_plans_new RENAME TO session_plans;

CREATE INDEX IF NOT EXISTS idx_session_plans_session ON session_plans(session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS plan_consumptions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  consumed_at INTEGER NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES session_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plan_consumptions_plan ON plan_consumptions(plan_id, consumed_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_consumptions_agent ON plan_consumptions(agent_id);
`;
