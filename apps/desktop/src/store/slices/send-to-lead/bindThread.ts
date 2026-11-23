import { addAgentSourceThread, getAgentById } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import type { SliceDeps } from '../../slice-types';

type Params = SliceDeps &
  Readonly<{
    sessionId: SessionId;
    agentId: AgentId;
    threadId: string;
  }>;

export type BindOutcome = 'bound' | 'held' | 'refused';

export const bindThread = async ({
  set,
  get,
  sessionId,
  agentId,
  threadId,
}: Params): Promise<BindOutcome> => {
  const isBound = await addAgentSourceThread({ db: tauriDatabase, id: agentId, threadId });
  if (!isBound) {
    const agent = await getAgentById(tauriDatabase, agentId);
    const isHeld =
      agent !== null && agent.status !== 'stopped' && agentThreadIds(agent).includes(threadId);
    return isHeld ? 'held' : 'refused';
  }
  if (get().sessionPhaseRuns[sessionId] !== undefined) {
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
          agent.id === agentId
            ? { ...agent, sourceThreadIds: [...new Set([...agentThreadIds(agent), threadId])] }
            : agent,
        ),
      },
    }));
  }
  return 'bound';
};
