import type { AutoDelegation } from '@goodboy/db';
import type { Agent } from '@goodboy/types';

const AUTO_NEVER_STARTED_MS = 60_000;

type Params = {
  readonly delegation: Pick<AutoDelegation, 'state' | 'settledAt' | 'createdAt'>;
  readonly childAgent: Pick<Agent, 'startedAt'> | null;
  readonly now: number;
};

export const isAutoChildNeverStarted = ({ delegation, childAgent, now }: Params): boolean => {
  if (delegation.state !== 'accepted' && delegation.state !== 'starting') {
    return false;
  }
  if (delegation.settledAt !== null) {
    return false;
  }
  if (childAgent?.startedAt !== undefined) {
    return false;
  }
  return now - delegation.createdAt >= AUTO_NEVER_STARTED_MS;
};
