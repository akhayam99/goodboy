import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
  status: Agent['status'];
}>;

export const restoreAgentStatus = async ({
  set,
  get,
  sessionId,
  agentId,
  status,
}: Params): Promise<void> => {
  let restored: Agent;
  try {
    restored = await invokeAgentUpdateStatus(agentId, { status });
  } catch (error) {
    void get().reportError({
      title: "Couldn't put the agent back to running",
      error,
      severity: 'warning',
      sessionId,
    });
    return;
  }
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
        agent.id === agentId ? restored : agent,
      ),
    },
  }));
};
