import type { AgentId } from '@goodboy/types';
import type { ResolverThreadOutcome } from '../../types';

type Params = {
  readonly outcomes: Readonly<Record<AgentId, Readonly<Record<string, ResolverThreadOutcome>>>>;
  readonly threadId: string;
};

export const resolverOutcomeForThread = ({
  outcomes,
  threadId,
}: Params): ResolverThreadOutcome | null => {
  for (const byThreadId of Object.values(outcomes)) {
    const outcome = byThreadId[threadId];
    if (outcome !== undefined) {
      return outcome;
    }
  }
  return null;
};
