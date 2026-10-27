import type { AgentId, ProviderRunId } from '@goodboy/types';

export type StopRequest = Readonly<{
  runId: ProviderRunId;
  at: number;
}>;

type RequestParams = Readonly<{
  agentId: AgentId;
  runId: ProviderRunId;
  at: number;
}>;

type AgentParams = Readonly<{
  agentId: AgentId;
}>;

type SubscribeParams = Readonly<{
  listener: () => void;
}>;

const requests = new Map<AgentId, StopRequest>();
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const listener of [...listeners]) {
    listener();
  }
};

export const stopRequests = {
  request: ({ agentId, runId, at }: RequestParams): void => {
    requests.set(agentId, { runId, at });
    emit();
  },
  settle: ({ agentId }: AgentParams): void => {
    if (requests.delete(agentId)) {
      emit();
    }
  },
  of: ({ agentId }: AgentParams): StopRequest | null => requests.get(agentId) ?? null,
  subscribe: ({ listener }: SubscribeParams): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
