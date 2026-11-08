import { CHECK_STATE } from '../notifications/errorRecovery';
import type { Agent, AgentId, AgentStoppedBy, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
  at: IsoDateTime;
  by: AgentStoppedBy;
}>;

export const markStoppedBy = async ({
  set,
  get,
  sessionId,
  agentId,
  at,
  by,
}: Params): Promise<Agent | null> => {
  let stopped: Agent;
  try {
    stopped = await invokeAgentUpdateStatus(agentId, {
      status: 'stopped',
      stoppedAt: at,
      stoppedBy: by,
    });
  } catch (error) {
    void get().reportError({
      recovery: CHECK_STATE,
      title: "Couldn't mark the agent as stopped",
      error,
      severity: 'warning',
      sessionId,
    });
    return null;
  }
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
        agent.id === agentId ? stopped : agent,
      ),
    },
  }));
  return stopped;
};
