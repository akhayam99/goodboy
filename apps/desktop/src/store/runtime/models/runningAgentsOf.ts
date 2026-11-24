import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'sessionPhaseRuns' | 'runRouting'>;
};

export const runningAgentsOf = ({
  state,
}: Params): ReadonlyArray<Readonly<{ provider: string; agentId: string }>> =>
  Object.values(state.sessionPhaseRuns ?? {}).flatMap((agents) =>
    agents.flatMap((agent) => {
      if (agent.status !== 'running' || agent.runId === undefined) {
        return [];
      }
      const provider = state.runRouting?.[agent.id]?.[agent.runId]?.provider;
      return provider === undefined ? [] : [{ provider, agentId: agent.id }];
    }),
  );
