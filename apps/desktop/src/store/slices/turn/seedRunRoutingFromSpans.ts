import type { AgentId, AgentTurnSpanRoute, ProviderRunId } from '@goodboy/types';
import type { ExecutedAgentRouting } from './executedAgentRouting';

type RunRouting = Readonly<Record<AgentId, Readonly<Record<ProviderRunId, ExecutedAgentRouting>>>>;

type Params = {
  readonly runRouting: RunRouting;
  readonly routes: ReadonlyArray<AgentTurnSpanRoute>;
};

export const seedRunRoutingFromSpans = ({ runRouting, routes }: Params): RunRouting => {
  if (routes.length === 0) {
    return runRouting;
  }
  const next: Record<AgentId, Readonly<Record<ProviderRunId, ExecutedAgentRouting>>> = {
    ...runRouting,
  };
  for (const route of routes) {
    const runs = next[route.agentId] ?? {};
    if (runs[route.runId] != null) {
      continue;
    }
    next[route.agentId] = {
      ...runs,
      [route.runId]: { provider: route.provider, model: route.model, effort: route.effort },
    };
  }
  return next;
};
