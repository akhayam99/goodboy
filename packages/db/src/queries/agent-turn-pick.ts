import type { AgentId, ProviderRunId } from '@goodboy/types';
import type { Database } from '../client';

export const AGENT_TURN_PICK_SOURCES = ['lead', 'fallback', 'pinned', 'best'] as const;

export type AgentTurnPickSource = (typeof AGENT_TURN_PICK_SOURCES)[number];

export type AgentTurnPick = Readonly<{
  runId: ProviderRunId;
  source: AgentTurnPickSource;
  adjustment: string | null;
  requestedModel: string | null;
}>;

export type AgentPickRecord = Readonly<{
  delegationRouting: string | null;
  routingDecision: string | null;
  routingLock: string | null;
}>;

type PickRecordRow = {
  readonly delegation_routing: string | null;
  readonly routing_decision: string | null;
  readonly routing_lock: string | null;
};

type ReadParams = {
  readonly db: Database;
  readonly agentId: AgentId;
};

export const readAgentPickRecord = async ({
  db,
  agentId,
}: ReadParams): Promise<AgentPickRecord | null> => {
  const rows = await db.select<PickRecordRow>(
    `SELECT (SELECT d.routing_json FROM auto_delegations d
              WHERE d.child_agent_id = a.id
              ORDER BY d.created_at DESC, d.id DESC
              LIMIT 1) AS delegation_routing,
            a.routing_decision, a.routing_lock
       FROM live_agents a
      WHERE a.id = ?`,
    [agentId],
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    delegationRouting: row.delegation_routing,
    routingDecision: row.routing_decision,
    routingLock: row.routing_lock,
  };
};

type InsertParams = {
  readonly db: Database;
  readonly pick: AgentTurnPick;
  readonly nowMs: number;
};

export const insertAgentTurnPick = async ({ db, pick, nowMs }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO agent_turn_picks
       (id, run_id, source, adjustment, requested_model, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (run_id) DO NOTHING`,
    [
      crypto.randomUUID(),
      pick.runId,
      pick.source,
      pick.adjustment,
      pick.requestedModel,
      nowMs,
      nowMs,
    ],
  );
};
