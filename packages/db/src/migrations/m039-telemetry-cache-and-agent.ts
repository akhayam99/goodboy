/**
 * m039 — telemetry granularity for the counterfactual cost engine.
 *
 * Adds three columns to telemetry_records:
 *   - cached_input_tokens   (cache-read; was unstored, recomputed at display
 *                            time from the live stream — now persisted so the
 *                            counterfactual engine can re-price historical
 *                            turns at any cache-hit-rate assumption).
 *   - cache_creation_5m_tokens / cache_creation_1h_tokens
 *                           (cache-write tiers; new from the parser change in
 *                            this PR. Previously dropped on the floor.)
 *   - agent_id              (nullable FK to agents. session_id alone scopes to
 *                            the chat; per-agent scope is needed to compute
 *                            "what if all these agents ran as one ballooning
 *                            chat" deltas. Nullable because historical rows
 *                            can't always be attributed back — agents.provider_run_id
 *                            only points to the latest run for each agent.)
 *
 * Best-effort backfill: for sessions with a single agent, attribute every
 * telemetry row to that agent. Multi-agent sessions stay NULL until new turns
 * land.
 */
export const m039TelemetryCacheAndAgent = /* sql */ `
ALTER TABLE telemetry_records ADD COLUMN cached_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_records ADD COLUMN cache_creation_5m_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_records ADD COLUMN cache_creation_1h_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_records ADD COLUMN agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;

-- Backfill agent_id for sessions where exactly one agent exists. Multi-agent
-- sessions can't be safely attributed from history (no run→agent map), they
-- remain NULL and the engine treats them as "unknown" rows.
UPDATE telemetry_records AS t
   SET agent_id = (
     SELECT a.id FROM agents a
      WHERE a.session_id = t.session_id
        AND a.deleted_at IS NULL
   )
 WHERE t.agent_id IS NULL
   AND (
     SELECT COUNT(*) FROM agents a
      WHERE a.session_id = t.session_id
        AND a.deleted_at IS NULL
   ) = 1;

CREATE INDEX idx_telemetry_agent_id
  ON telemetry_records(agent_id)
  WHERE agent_id IS NOT NULL;
`;
