import type { AutoDelegation } from '@goodboy/db';
import type { Agent } from '@goodboy/types';

const AUTO_NEVER_STARTED_MS = 60_000;

type Params = {
  readonly delegation: Pick<AutoDelegation, 'state' | 'settledAt'>;
  readonly childAgent: Pick<Agent, 'startedAt'> | null;
  readonly now: number;
  readonly startableSince: number | null;
};

export const isAutoChildNeverStarted = ({
  delegation,
  childAgent,
  now,
  startableSince,
}: Params): boolean => {
  if (delegation.state !== 'accepted' && delegation.state !== 'starting') {
    return false;
  }
  if (delegation.settledAt !== null || startableSince === null) {
    return false;
  }
  if (childAgent?.startedAt !== undefined) {
    return false;
  }
  return now - startableSince >= AUTO_NEVER_STARTED_MS;
};
