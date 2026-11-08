import type { AgentId } from '@goodboy/types';
import { AUTO_MESSAGE_QUEUE_PREFIX } from '../../../features/auto/AUTO_MESSAGE_QUEUE_PREFIX';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  agentId: AgentId;
}>;

export const dropAutoMessages = async ({ set, get, agentId }: Params): Promise<void> => {
  const current = readAgentQueue({ get, agentId });
  const kept = current.filter(
    (item) => item.status === 'sending' || !item.id.startsWith(AUTO_MESSAGE_QUEUE_PREFIX),
  );
  if (kept.length === current.length) {
    return;
  }
  writeAgentQueue({ set, agentId, queue: kept });
  await persistAgentQueue({ get, agentId });
};
