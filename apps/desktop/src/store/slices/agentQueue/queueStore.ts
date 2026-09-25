import {
  listAgentQueuedMessages,
  replaceAgentQueuedMessages,
  type AgentQueuedMessageRecord,
} from '@goodboy/db';
import { PROVIDER_IDS, type AgentId, type TurnProviderOverride } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import type { AgentQueuedTurn, GetFn, QueuedAttachment, SetFn } from './types';

const EMPTY: ReadonlyArray<AgentQueuedTurn> = [];

type AgentParams = Readonly<{
  get: GetFn;
  agentId: AgentId;
}>;

export const readAgentQueue = ({ get, agentId }: AgentParams): ReadonlyArray<AgentQueuedTurn> =>
  get().agentQueue[agentId] ?? EMPTY;

type WriteParams = Readonly<{
  set: SetFn;
  agentId: AgentId;
  queue: ReadonlyArray<AgentQueuedTurn>;
}>;

export const writeAgentQueue = ({ set, agentId, queue }: WriteParams): void => {
  set((state) => {
    if (queue.length > 0) {
      return { agentQueue: { ...state.agentQueue, [agentId]: queue } };
    }
    if (!(agentId in state.agentQueue)) {
      return state;
    }
    const next = { ...state.agentQueue };
    delete next[agentId];
    return { agentQueue: next };
  });
};

const toRecord = (turn: AgentQueuedTurn): AgentQueuedMessageRecord => ({
  id: turn.id,
  agentId: turn.agentId,
  content: turn.content,
  attachments: turn.attachments,
  override: turn.override ?? null,
  createdAt: turn.createdAt,
});

const persistQueue = createKeyedQueue();

export const persistAgentQueue = ({ get, agentId }: AgentParams): Promise<void> =>
  persistQueue
    .run({
      key: agentId,
      task: () =>
        replaceAgentQueuedMessages(tauriDatabase, {
          agentId,
          messages: readAgentQueue({ get, agentId }).map(toRecord),
        }),
    })
    .catch(() => undefined);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toAttachment = (value: unknown): QueuedAttachment | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, fileName, mimeType, dataUrl, relPath } = value;
  if (
    typeof id !== 'string' ||
    typeof fileName !== 'string' ||
    typeof mimeType !== 'string' ||
    typeof dataUrl !== 'string'
  ) {
    return null;
  }
  return { id, fileName, mimeType, dataUrl, relPath: typeof relPath === 'string' ? relPath : null };
};

const toOverride = (
  value: Readonly<Record<string, unknown>> | null,
): TurnProviderOverride | undefined => {
  if (value === null || !PROVIDER_IDS.some((id) => id === value.providerId)) {
    return undefined;
  }
  return value as TurnProviderOverride;
};

export const fromQueuedRecord = (record: AgentQueuedMessageRecord): AgentQueuedTurn => ({
  id: record.id,
  agentId: record.agentId,
  content: record.content,
  attachments: record.attachments.flatMap((entry) => {
    const attachment = toAttachment(entry);
    return attachment === null ? [] : [attachment];
  }),
  override: toOverride(record.override),
  status: 'queued',
  createdAt: record.createdAt,
});

export const readPersistedQueues = async (
  agentIds: ReadonlyArray<AgentId>,
): Promise<ReadonlyMap<AgentId, ReadonlyArray<AgentQueuedTurn>>> => {
  const records = await listAgentQueuedMessages(tauriDatabase, agentIds).catch(() => []);
  const grouped = new Map<AgentId, ReadonlyArray<AgentQueuedTurn>>();
  for (const record of records) {
    grouped.set(record.agentId, [...(grouped.get(record.agentId) ?? []), fromQueuedRecord(record)]);
  }
  return grouped;
};
