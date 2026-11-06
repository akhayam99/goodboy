import type { SetFocusedRunAgentParams, SetFn } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

export const setFocusedRunAgent = ({ set }: FactoryParams) => {
  return ({ sessionId, agentId }: SetFocusedRunAgentParams): void => {
    set((s) => ({ focusedRunAgentId: { ...s.focusedRunAgentId, [sessionId]: agentId } }));
  };
};
