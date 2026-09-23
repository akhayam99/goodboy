import type { CapabilityObligation, SessionId } from '@goodboy/types';
import {
  invokeClusterCompletionHoldResolve,
  invokeClusterCompletionHolds,
} from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligation: CapabilityObligation;
  readonly isRequesterContinuing: boolean;
};

type ContinuingParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly holdIds: ReadonlyArray<string>;
  readonly resolutionEvidence: string;
};

export const releaseHoldsForContinuingRequester = async ({
  set,
  get,
  sessionId,
  holdIds,
  resolutionEvidence,
}: ContinuingParams): Promise<ReadonlyArray<string>> => {
  const open = (get().clusterCompletionHolds?.[sessionId] ?? []).filter(
    (hold) => holdIds.includes(hold.id) && hold.state === 'open',
  );
  for (const hold of open) {
    await invokeClusterCompletionHoldResolve({ id: hold.id, resolutionEvidence });
  }
  if (open.length > 0) {
    const holds = await invokeClusterCompletionHolds({ sessionId });
    set((state) => ({
      clusterCompletionHolds: { ...state.clusterCompletionHolds, [sessionId]: holds },
    }));
  }
  return open.map((hold) => hold.id);
};

export const releaseCapabilityHolds = async ({
  set,
  get,
  sessionId,
  obligation,
  isRequesterContinuing,
}: Params): Promise<ReadonlyArray<string>> => {
  if (obligation.state !== 'satisfied') {
    return [];
  }
  const resolutionEvidence =
    obligation.deliveryReceipt ??
    `closed against revision ${obligation.satisfiedRevision ?? 'unknown'}`;
  if (isRequesterContinuing) {
    return releaseHoldsForContinuingRequester({
      set,
      get,
      sessionId,
      holdIds: obligation.holdIds,
      resolutionEvidence,
    });
  }
  const open = (get().clusterCompletionHolds?.[sessionId] ?? []).filter(
    (hold) => obligation.holdIds.includes(hold.id) && hold.state === 'open',
  );
  const released: string[] = [];
  for (const hold of open) {
    await get().resolveClusterCompletionHold({
      sessionId,
      holdId: hold.id,
      resolutionEvidence,
    });
    released.push(hold.id);
  }
  return released;
};
