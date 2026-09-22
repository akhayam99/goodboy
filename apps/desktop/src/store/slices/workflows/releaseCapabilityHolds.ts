import type { CapabilityObligation, SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligation: CapabilityObligation;
};

export const releaseCapabilityHolds = async ({
  get,
  sessionId,
  obligation,
}: Params): Promise<ReadonlyArray<string>> => {
  if (obligation.state !== 'satisfied') {
    return [];
  }
  const open = (get().clusterCompletionHolds?.[sessionId] ?? []).filter(
    (hold) => obligation.holdIds.includes(hold.id) && hold.state === 'open',
  );
  const released: string[] = [];
  for (const hold of open) {
    await get().resolveClusterCompletionHold({
      sessionId,
      holdId: hold.id,
      resolutionEvidence:
        obligation.deliveryReceipt ??
        `closed against revision ${obligation.satisfiedRevision ?? 'unknown'}`,
    });
    released.push(hold.id);
  }
  return released;
};
