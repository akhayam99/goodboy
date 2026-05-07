export const m005BudgetTables = /* sql */ `
CREATE TABLE IF NOT EXISTS budget_rules (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly')),
  cap_usd REAL NOT NULL,
  alert_threshold_pct REAL NOT NULL DEFAULT 80,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_budget_rules_provider ON budget_rules(provider);

CREATE TABLE IF NOT EXISTS session_budgets (
  session_id TEXT PRIMARY KEY,
  soft_cap_usd REAL NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('provider-threshold','provider-exceeded','session-threshold','session-exceeded')),
  provider TEXT,
  session_id TEXT,
  current_usd REAL NOT NULL,
  cap_usd REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_session_id ON budget_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_provider ON budget_alerts(provider);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_created_at ON budget_alerts(created_at);
`;
