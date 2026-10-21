import type { AgentId } from '@goodboy/types';
import type { Database } from '../client';

type OpenRow = {
  readonly found: number;
};

type HasAgentOpenToolCallParams = {
  readonly db: Database;
  readonly agentId: AgentId;
  readonly sinceMs: number;
};

export const hasAgentOpenToolCall = async ({
  db,
  agentId,
  sinceMs,
}: HasAgentOpenToolCallParams): Promise<boolean> => {
  const rows = await db.select<OpenRow>(
    `SELECT 1 AS found FROM turn_events started
     WHERE started.agent_id = ? AND started.created_at >= ?
       AND json_extract(started.payload, '$.kind') = 'tool_call_start'
       AND NOT EXISTS (
         SELECT 1 FROM turn_events ended
         WHERE ended.agent_id = started.agent_id
           AND ended.created_at >= started.created_at
           AND json_extract(ended.payload, '$.kind') = 'tool_call_end'
           AND json_extract(ended.payload, '$.toolUseId') = json_extract(started.payload, '$.toolUseId')
       )
     LIMIT 1`,
    [agentId, sinceMs],
  );
  return rows.length > 0;
};
