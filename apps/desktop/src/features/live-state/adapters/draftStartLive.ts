import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import { pendingOperationLive } from './pendingOperationLive';

export type DraftStartLiveParams = Readonly<{
  isStarting: boolean;
  startError: string | null;
}>;

export const draftStartLive = ({
  isStarting,
  startError,
}: DraftStartLiveParams): TailFacts | null =>
  pendingOperationLive({
    isPending: isStarting,
    pendingPhrase: 'Starting the session',
    startedAt: null,
    pendingActions: [],
    failure: startError,
    failureLead: 'Could not start',
    failureActions: [TAIL_ACTION.retry],
  });
