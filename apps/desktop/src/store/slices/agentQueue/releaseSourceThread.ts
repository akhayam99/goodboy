import { removeAgentSourceThread } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
  threadId: string;
}>;

export const releaseSourceThread = async ({
  set,
  get,
  sessionId,
  agentId,
  threadId,
}: Params): Promise<void> => {
  await removeAgentSourceThread({ db: tauriDatabase, id: agentId, threadId });
  const agents = get().sessionPhaseRuns[sessionId];
  if (agents === undefined) {
    return;
  }
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? agents).map((agent) =>
        agent.id === agentId
          ? { ...agent, sourceThreadIds: agentThreadIds(agent).filter((id) => id !== threadId) }
          : agent,
      ),
    },
  }));
};
