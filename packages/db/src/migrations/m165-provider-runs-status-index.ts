export const m165ProviderRunsStatusIndex = `
CREATE INDEX IF NOT EXISTS idx_provider_runs_status_created
  ON provider_runs(status_kind, created_at);
`;
