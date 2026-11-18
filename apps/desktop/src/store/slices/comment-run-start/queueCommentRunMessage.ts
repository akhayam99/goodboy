import type { AgentId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { readAgentQueue, writeAgentQueue } from '../agentQueue/queueStore';

type Params = SliceDeps & {
  readonly agentId: AgentId;
  readonly content: string;
};

export const queueCommentRunMessage = async ({
  set,
  get,
  agentId,
  content,
}: Params): Promise<boolean> => {
  const turnId = crypto.randomUUID();
  const isSaved = await get().enqueueAgentMessage({
    turn: { id: turnId, agentId, content, attachments: [], override: undefined },
  });
  if (!isSaved) {
    writeAgentQueue({
      set,
      agentId,
      queue: readAgentQueue({ get, agentId }).filter((item) => item.id !== turnId),
    });
  }
  return isSaved;
};
