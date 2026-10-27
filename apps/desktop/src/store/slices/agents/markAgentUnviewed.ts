import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { invokeAgentMarkUnviewed } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type AgentParams = {
  readonly agent: Agent;
};

const withoutViewed = ({ agent }: AgentParams): Agent => {
  const { lastViewedAt: _viewedAt, ...rest } = agent;
  return rest;
};

type FactoryParams = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const markAgentUnviewed = ({ set, get }: FactoryParams) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    const agent = (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
    if (agent === undefined || agent.lastViewedAt === undefined) {
      return;
    }
    await invokeAgentMarkUnviewed({ id: agentId });
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((run) =>
          run.id === agentId ? withoutViewed({ agent: run }) : run,
        ),
      },
    }));
    void get().refreshUnreadWorkspaces();
  };
};
