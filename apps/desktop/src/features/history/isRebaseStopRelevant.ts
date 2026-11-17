import type { WorktreeStatus } from '@goodboy/types';
import type { HistoryStopReason } from '../../store/slices/history/types';
import { changedCount, distanceAhead } from '../../shared/lib/gitStatus';
import { isRebaseStopSettled } from './isRebaseStopSettled';

type Params = {
  readonly reason: HistoryStopReason | undefined;
  readonly head: string | null;
  readonly status: WorktreeStatus | null;
};

type StatusParams = {
  readonly status: WorktreeStatus;
};

const isOriginCaughtUp = ({ status }: StatusParams): boolean =>
  status.inProgress == null &&
  status.upstream !== null &&
  distanceAhead({ distance: status.upstreamDistance }) === 0;

type HeadParams = {
  readonly head: string | null;
  readonly status: WorktreeStatus;
};

const hasHeadMoved = ({ head, status }: HeadParams): boolean => {
  const current = status.head;
  return (
    head !== null && current !== null && !current.startsWith(head) && !head.startsWith(current)
  );
};

export const isRebaseStopRelevant = ({ reason, head, status }: Params): boolean => {
  if (status === null) {
    return true;
  }
  if (reason === 'origin-moved' || reason === 'push-failed') {
    return !isOriginCaughtUp({ status });
  }
  if (reason === 'dirty') {
    return (
      changedCount({ workingTree: status.workingTree }) !== 0 && !hasHeadMoved({ head, status })
    );
  }
  return !isRebaseStopSettled({ status, head });
};
