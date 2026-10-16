import type { IsoDateTime } from '@goodboy/types';
import type { TailAction, TailFacts } from '../tailFacts';

export type PendingOperationLiveParams = Readonly<{
  isPending: boolean;
  pendingPhrase: string;
  startedAt: IsoDateTime | null;
  pendingActions: ReadonlyArray<TailAction>;
  failure: string | null;
  failureLead: string;
  failureActions: ReadonlyArray<TailAction>;
}>;

export const pendingOperationLive = ({
  isPending,
  pendingPhrase,
  startedAt,
  pendingActions,
  failure,
  failureLead,
  failureActions,
}: PendingOperationLiveParams): TailFacts | null => {
  if (isPending) {
    return { state: 'working', phrase: pendingPhrase, startedAt, actions: pendingActions };
  }
  if (failure !== null) {
    return {
      state: 'failed',
      phrase: `${failureLead}: ${failure}`,
      startedAt: null,
      actions: failureActions,
    };
  }
  return null;
};
