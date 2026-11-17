import type { Agent, MountId } from '@goodboy/types';
import { commentRunOf } from './commentRunOf';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly threadId: string;
  readonly mountId: MountId | null;
};

export const joinableCommentRunsOf = ({
  agents,
  threadId,
  mountId,
}: Params): ReadonlyArray<Agent> => {
  if (mountId === null || commentRunOf({ agents, threadId }) !== null) {
    return [];
  }
  return agents
    .filter(
      (agent) =>
        agent.deletedAt == null &&
        agent.sourceKind === 'comment_run' &&
        agent.status !== 'stopped' &&
        agent.doneAt == null &&
        agent.mountId === mountId,
    )
    .sort((left, right) => right.ordinal - left.ordinal);
};
