import type { Agent } from '@goodboy/types';
import { useAppStore, useExecutedAgentRouting } from '../../../../store';

type Params = {
  readonly agent: Agent;
};

export const useAgentRowProvider = ({ agent }: Params): string | null => {
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  const executed = useExecutedAgentRouting({ agent });
  return executed?.provider ?? providerOverride;
};
