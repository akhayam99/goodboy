export const m173SpendReservationsWriterLeases = `
ALTER TABLE invocation_tickets ADD COLUMN budget_identity TEXT;
ALTER TABLE invocation_tickets ADD COLUMN budget_period_start INTEGER;
ALTER TABLE invocation_tickets ADD COLUMN budget_period_end INTEGER;
ALTER TABLE invocation_tickets ADD COLUMN estimated_spend_usd REAL CHECK (estimated_spend_usd IS NULL OR estimated_spend_usd >= 0);
ALTER TABLE invocation_tickets ADD COLUMN measured_spend_usd REAL CHECK (measured_spend_usd IS NULL OR measured_spend_usd >= 0);
ALTER TABLE invocation_tickets ADD COLUMN reservation_status TEXT NOT NULL DEFAULT 'none' CHECK (reservation_status IN ('none','reserved','settled','released'));
ALTER TABLE invocation_tickets ADD COLUMN measurement_status TEXT NOT NULL DEFAULT 'none' CHECK (measurement_status IN ('none','pending','measured','unknown'));
ALTER TABLE invocation_tickets ADD COLUMN reservation_settled_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_invocation_tickets_budget_reservation ON invocation_tickets(budget_identity, reservation_status, budget_period_start, budget_period_end);

CREATE TABLE IF NOT EXISTS writer_leases (
  id TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('active','unknown','released')),
  owner_process_id INTEGER NOT NULL,
  process_id INTEGER,
  run_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  released_at INTEGER
);
CREATE TABLE IF NOT EXISTS writer_lease_resources (
  lease_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  PRIMARY KEY (lease_id, resource),
  FOREIGN KEY (lease_id) REFERENCES writer_leases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_writer_lease_resources_resource ON writer_lease_resources(resource, lease_id);
`;
