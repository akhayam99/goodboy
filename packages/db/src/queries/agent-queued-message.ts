import type { AgentId, IsoDateTime } from '@goodboy/types';
import type { Database } from '../client';
import { isJsonArray, isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

export type AgentQueuedMessageRecord = Readonly<{
  id: string;
  agentId: AgentId;
  content: string;
  attachments: ReadonlyArray<unknown>;
  override: Readonly<Record<string, unknown>> | null;
  createdAt: IsoDateTime;
}>;

type Row = {
  readonly id: string;
  readonly agent_id: string;
  readonly content: string;
  readonly attachments_json: string;
  readonly override_json: string | null;
  readonly created_at: number;
};

const isOverride = (value: unknown): value is Readonly<Record<string, unknown>> | null =>
  value === null || isJsonRecord(value);

const toRecord = (row: Row): AgentQueuedMessageRecord => ({
  id: row.id,
  agentId: row.agent_id as AgentId,
  content: row.content,
  attachments: parseJsonColumn({ value: row.attachments_json, isValid: isJsonArray, fallback: [] }),
  override: parseJsonColumn({ value: row.override_json, isValid: isOverride, fallback: null }),
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

export const listAgentQueuedMessages = async (
  db: Database,
  agentIds: ReadonlyArray<AgentId>,
): Promise<ReadonlyArray<AgentQueuedMessageRecord>> => {
  if (agentIds.length === 0) {
    return [];
  }
  const placeholders = agentIds.map(() => '?').join(', ');
  const rows = await db.select<Row>(
    `SELECT id, agent_id, content, attachments_json, override_json, created_at
       FROM agent_queued_messages
      WHERE agent_id IN (${placeholders})
      ORDER BY agent_id, position`,
    agentIds,
  );
  return rows.map(toRecord);
};

type ReplaceParams = Readonly<{
  agentId: AgentId;
  messages: ReadonlyArray<AgentQueuedMessageRecord>;
}>;

export const replaceAgentQueuedMessages = async (
  db: Database,
  { agentId, messages }: ReplaceParams,
): Promise<void> => {
  await db.transaction({
    statements: [
      { sql: 'DELETE FROM agent_queued_messages WHERE agent_id = ?', params: [agentId] },
      ...messages.map((message, position) => ({
        sql: `INSERT INTO agent_queued_messages
                (id, agent_id, position, content, attachments_json, override_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          message.id,
          agentId,
          position,
          message.content,
          JSON.stringify(message.attachments),
          message.override === null ? null : JSON.stringify(message.override),
          Date.parse(message.createdAt),
        ],
      })),
    ],
  });
};
