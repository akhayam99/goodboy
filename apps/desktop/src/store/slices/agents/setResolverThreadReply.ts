import type { AgentId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly agentId: AgentId;
  readonly threadId: string;
  readonly reply: string;
};

export const setResolverThreadReply = (set: SetFn) => {
  return ({ agentId, threadId, reply }: Params): void => {
    set((state) => {
      const outcomes = state.resolverThreadOutcomes[agentId];
      const outcome = outcomes?.[threadId];
      if (outcomes === undefined || outcome === undefined) {
        return {};
      }
      return {
        resolverThreadOutcomes: {
          ...state.resolverThreadOutcomes,
          [agentId]: { ...outcomes, [threadId]: { ...outcome, reply } },
        },
      };
    });
  };
};
