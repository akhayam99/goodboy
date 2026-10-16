import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import { pendingOperationLive } from './pendingOperationLive';

export type ProcessStopLiveParams = Readonly<{
  name: string;
  isStopping: boolean;
  hasTimedOut: boolean;
  failure: string | null;
}>;

export const processStopLive = ({
  name,
  isStopping,
  hasTimedOut,
  failure,
}: ProcessStopLiveParams): TailFacts | null => {
  if (hasTimedOut) {
    return {
      state: 'failed',
      phrase: `${name} did not stop`,
      startedAt: null,
      actions: [TAIL_ACTION.forceStop],
    };
  }
  return pendingOperationLive({
    isPending: isStopping,
    pendingPhrase: `Stopping ${name}`,
    startedAt: null,
    pendingActions: [],
    failure,
    failureLead: `Could not stop ${name}`,
    failureActions: [TAIL_ACTION.retry],
  });
};
