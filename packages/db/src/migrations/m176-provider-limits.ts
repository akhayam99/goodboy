export const m176ProviderLimits = `
CREATE TABLE IF NOT EXISTS provider_limits (
  provider_id TEXT PRIMARY KEY,
  plan TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'reached')),
  windows TEXT NOT NULL DEFAULT '[]',
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
