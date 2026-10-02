import type { Agent, AgentId } from '@goodboy/types';
import { agentThreadIds } from '../session/agentThreadIds';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly threadId: string;
};

export const recheckParentOf = ({ agents, threadId }: Params): AgentId | null =>
  agents
    .filter(
      (agent) =>
        agent.deletedAt == null &&
        agent.sourceKind === 'review_comment' &&
        agentThreadIds(agent).includes(threadId),
    )
    .reduce<Agent | null>(
      (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
      null,
    )?.id ?? null;
