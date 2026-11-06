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
  holdReason?: string | null;
  writtenTexts?: number;
}>;

type Row = {
  readonly id: string;
  readonly agent_id: string;
  readonly content: string;
  readonly attachments_json: string;
  readonly override_json: string | null;
  readonly created_at: number;
};

type QueueState = Readonly<{
  holdReason: string | null;
  writtenTexts: number;
}>;

type SplitOverride = Readonly<{
  override: Readonly<Record<string, unknown>> | null;
  state: QueueState;
}>;

type ValueParams = Readonly<{
  value: unknown;
}>;

type ColumnParams = Readonly<{
  value: string | null;
}>;

type MessageParams = Readonly<{
  message: AgentQueuedMessageRecord;
}>;

const QUEUE_STATE_KEY = 'queueState';

const NO_STATE: QueueState = { holdReason: null, writtenTexts: 0 };

const isOverride = (value: unknown): value is Readonly<Record<string, unknown>> | null =>
  value === null || isJsonRecord(value);

const queueStateOf = ({ value }: ValueParams): QueueState => {
  if (!isJsonRecord(value)) {
    return NO_STATE;
  }
  const { holdReason, writtenTexts } = value;
  return {
    holdReason: typeof holdReason === 'string' ? holdReason : null,
    writtenTexts:
      typeof writtenTexts === 'number' && Number.isInteger(writtenTexts) && writtenTexts > 0
        ? writtenTexts
        : 0,
  };
};

const splitOverride = ({ value }: ColumnParams): SplitOverride => {
  const parsed = parseJsonColumn({ value, isValid: isOverride, fallback: null });
  if (parsed === null || !(QUEUE_STATE_KEY in parsed)) {
    return { override: parsed, state: NO_STATE };
  }
  const { [QUEUE_STATE_KEY]: state, ...rest } = parsed;
  return {
    override: Object.keys(rest).length > 0 ? rest : null,
    state: queueStateOf({ value: state }),
  };
};

const overrideColumnOf = ({ message }: MessageParams): string | null => {
  const holdReason = message.holdReason ?? null;
  const writtenTexts = message.writtenTexts ?? 0;
  if (holdReason === null && writtenTexts === 0) {
    return message.override === null ? null : JSON.stringify(message.override);
  }
  return JSON.stringify({
    ...message.override,
    [QUEUE_STATE_KEY]: { holdReason, writtenTexts },
  });
};

const toRecord = (row: Row): AgentQueuedMessageRecord => {
  const { override, state } = splitOverride({ value: row.override_json });
  return {
    id: row.id,
    agentId: row.agent_id as AgentId,
    content: row.content,
    attachments: parseJsonColumn({
      value: row.attachments_json,
      isValid: isJsonArray,
      fallback: [],
    }),
    override,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    holdReason: state.holdReason,
    writtenTexts: state.writtenTexts,
  };
};

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
          overrideColumnOf({ message }),
          Date.parse(message.createdAt),
        ],
      })),
    ],
  });
};
