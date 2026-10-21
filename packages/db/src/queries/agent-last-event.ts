import type { AgentId } from '@goodboy/types';
import type { Database } from '../client';

type LastEventRow = {
  readonly at: number | null;
};

type ReadAgentLastEventAtParams = {
  readonly db: Database;
  readonly agentId: AgentId;
  readonly sinceMs: number;
};

export const readAgentLastEventAt = async ({
  db,
  agentId,
  sinceMs,
}: ReadAgentLastEventAtParams): Promise<number | null> => {
  const rows = await db.select<LastEventRow>(
    'SELECT MAX(created_at) AS at FROM turn_events WHERE agent_id = ? AND created_at >= ?',
    [agentId, sinceMs],
  );
  return rows[0]?.at ?? null;
};
