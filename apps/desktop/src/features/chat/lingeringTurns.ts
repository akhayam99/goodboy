import type { AgentId, ProviderRunId } from '@goodboy/types';

const runs = new Map<AgentId, ProviderRunId>();

type MarkParams = {
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
};

type AgentParams = {
  readonly agentId: AgentId;
};

export const lingeringTurns = {
  mark: ({ agentId, runId }: MarkParams): void => {
    runs.set(agentId, runId);
  },
  clear: ({ agentId, runId }: MarkParams): void => {
    if (runs.get(agentId) === runId) {
      runs.delete(agentId);
    }
  },
  runOf: ({ agentId }: AgentParams): ProviderRunId | undefined => runs.get(agentId),
};
