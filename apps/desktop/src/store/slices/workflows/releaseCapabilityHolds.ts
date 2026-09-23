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
  const open = (get().clusterCompletionHolds?.[sessionId] ?? []).filter(
    (hold) => obligation.holdIds.includes(hold.id) && hold.state === 'open',
  );
  const resolutionEvidence =
    obligation.deliveryReceipt ??
    `closed against revision ${obligation.satisfiedRevision ?? 'unknown'}`;
  const released: string[] = [];
  for (const hold of open) {
    if (isRequesterContinuing) {
      await invokeClusterCompletionHoldResolve({ id: hold.id, resolutionEvidence });
      released.push(hold.id);
      continue;
    }
    await get().resolveClusterCompletionHold({
      sessionId,
      holdId: hold.id,
      resolutionEvidence,
    });
    released.push(hold.id);
  }
  if (isRequesterContinuing && released.length > 0) {
    const holds = await invokeClusterCompletionHolds({ sessionId });
    set((state) => ({
      clusterCompletionHolds: { ...state.clusterCompletionHolds, [sessionId]: holds },
    }));
  }
  return released;
};
