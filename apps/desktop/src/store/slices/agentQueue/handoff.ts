import type { AgentId } from '@goodboy/types';

type Params = Readonly<{
  agentId: AgentId;
}>;

const pending = new Set<AgentId>();

export const beginHandoff = ({ agentId }: Params): boolean => {
  if (pending.has(agentId)) {
    return false;
  }
  pending.add(agentId);
  return true;
};

export const endHandoff = ({ agentId }: Params): void => {
  pending.delete(agentId);
};

export const isHandoffPending = ({ agentId }: Params): boolean => pending.has(agentId);

export const resetHandoffs = (): void => {
  pending.clear();
};
