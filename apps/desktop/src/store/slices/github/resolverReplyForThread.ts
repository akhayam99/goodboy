import type { AgentId } from '@goodboy/types';
import type { ResolverThreadOutcome } from '../../types';

type Outcomes = Readonly<Record<AgentId, Readonly<Record<string, ResolverThreadOutcome>>>>;

export const resolverReplyForThread = (outcomes: Outcomes, threadId: string): string | null => {
  for (const byThreadId of Object.values(outcomes)) {
    const reply = byThreadId[threadId]?.reply?.trim();
    if (reply != null && reply.length > 0) {
      return reply;
    }
  }
  return null;
};
