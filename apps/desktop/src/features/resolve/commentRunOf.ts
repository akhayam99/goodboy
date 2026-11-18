import type { Agent, AgentId } from '@goodboy/types';
import { agentThreadIds } from '../session/agentThreadIds';
import { isLiveCommentRun } from './isLiveCommentRun';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly threadId: string;
};

export const commentRunOf = ({ agents, threadId }: Params): AgentId | null =>
  agents
    .filter((agent) => isLiveCommentRun({ agent }) && agentThreadIds(agent).includes(threadId))
    .reduce<Agent | null>(
      (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
      null,
    )?.id ?? null;
