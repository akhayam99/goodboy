import type { AgentId, SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { readAgentQueue, writeAgentQueue } from '../agentQueue/queueStore';

type Params = SliceDeps & {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly content: string;
  readonly sourceThreadId?: string;
};

export const queueCommentRunMessage = async ({
  set,
  get,
  sessionId,
  agentId,
  content,
  sourceThreadId,
}: Params): Promise<boolean> => {
  const turnId = crypto.randomUUID();
  const isSaved = await get().enqueueAgentMessage({
    turn: {
      id: turnId,
      agentId,
      content,
      attachments: [],
      override: undefined,
      ...(sourceThreadId !== undefined && { sourceThreadId }),
    },
  });
  if (!isSaved) {
    writeAgentQueue({
      set,
      agentId,
      queue: readAgentQueue({ get, agentId }).filter((item) => item.id !== turnId),
    });
    return false;
  }
  void get().drainAgentQueue({ sessionId, agentId });
  return true;
};
