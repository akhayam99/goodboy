import type { Agent, ProviderId, Session } from '@goodboy/types';
import { useAppStore, useExecutedAgentRouting } from '../../../../../store';
import { agentStoppedCopy, type AgentStoppedCopy } from '../agentStoppedCopy';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isAutoChild: boolean;
};

export type AgentStoppedView = {
  readonly copy: AgentStoppedCopy;
  readonly provider: ProviderId;
};

export const useAgentStoppedCopy = ({ session, agent, isAutoChild }: Params): AgentStoppedView => {
  const executed = useExecutedAgentRouting({ agent });
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  const authResults = useAppStore((state) => state.authResults);
  const executedProvider = executed?.provider ?? null;
  const provider =
    executedProvider === null || executedProvider === 'openai'
      ? (providerOverride ?? session.providerPreference.defaultProvider)
      : executedProvider;
  const isProviderConnected = authResults?.[provider]?.state !== 'disconnected';
  return {
    copy: agentStoppedCopy({ agent, provider, isProviderConnected, isAutoChild }),
    provider,
  };
};
