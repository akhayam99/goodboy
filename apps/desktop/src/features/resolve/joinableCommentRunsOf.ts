import type { Agent, MountId } from '@goodboy/types';
import { canHoldThreads } from '../work/sendToLead/canHoldThreads';
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
        canHoldThreads({ agent }) &&
        agent.status !== 'stopped' &&
        agent.doneAt == null &&
        agent.mountId === mountId,
    )
    .sort((left, right) => right.ordinal - left.ordinal);
};
