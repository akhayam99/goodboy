import type { Agent } from '@goodboy/types';
import { useAppStore, useExecutedAgentRouting } from '../../../../../store';
import { executedRoutingOf, type ShownRouting } from '../../../../auto/executedRoutingOf';
import { modelLineOf, type ModelLine } from '../../modelLineOf';

type Params = {
  readonly agent: Agent;
  readonly routing?: ShownRouting | null;
};

export const useAgentModelLine = ({ agent, routing = null }: Params): ModelLine | null => {
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  const modelOverride = useAppStore(
    (state) => state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null,
  );
  const effortOverride = useAppStore(
    (state) => state.agentEffortOverride[agent.id] ?? agent.effort ?? null,
  );
  const executed = useExecutedAgentRouting({ agent });
  const shown = executedRoutingOf({
    executed,
    fallback: routing ?? {
      provider: providerOverride,
      model: modelOverride,
      effort: effortOverride,
    },
  });
  return modelLineOf(shown);
};
