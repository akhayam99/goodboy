import type { WorktreeStatus } from '@goodboy/types';
import { distanceBehind, unmergedCount } from '../../shared/lib/gitStatus';

type Params = {
  readonly status: WorktreeStatus | null | undefined;
  readonly head: string | null;
};

export const isRebaseStopSettled = ({ status, head }: Params): boolean => {
  if (status === null || status === undefined || status.inProgress === 'rebase') {
    return false;
  }
  if (unmergedCount({ workingTree: status.workingTree }) !== 0) {
    return false;
  }
  if (distanceBehind({ distance: status.mainDistance }) !== 0) {
    return false;
  }
  if (head === null) {
    return true;
  }
  const current = status.head;
  return current !== null && !current.startsWith(head) && !head.startsWith(current);
};
