import type { IsoDateTime } from '@goodboy/types';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import { pendingOperationLive } from './pendingOperationLive';

export type CleanupLiveParams = Readonly<{
  project: string;
  isClosing: boolean;
  startedAt: IsoDateTime | null;
  failure: string | null;
}>;

export const cleanupLive = ({
  project,
  isClosing,
  startedAt,
  failure,
}: CleanupLiveParams): TailFacts | null =>
  pendingOperationLive({
    isPending: isClosing,
    pendingPhrase: `Closing the ${project} worktree`,
    startedAt,
    pendingActions: [],
    failure,
    failureLead: 'Could not close',
    failureActions: [TAIL_ACTION.retry],
  });
