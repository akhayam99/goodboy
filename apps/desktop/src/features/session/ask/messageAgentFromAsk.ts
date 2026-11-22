import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  messageId: string;
  text: string;
  getState: () => AppStore;
}>;

export const messageAgentFromAsk = async ({
  sessionId,
  agentId,
  messageId,
  text,
  getState,
}: Params): Promise<boolean> => {
  const isQueued = await getState().enqueueAgentMessage({
    turn: { id: messageId, agentId, content: text, attachments: [], override: undefined },
    shouldDropUnsaved: true,
  });
  if (!isQueued) {
    return false;
  }
  void getState().drainAgentQueue({ sessionId, agentId });
  return true;
};
