import { AUTO_SUBSTEPS_PER_PARENT, substepLinkOf } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';

type Params = {
  readonly open: ReadonlyArray<AutoDelegation>;
  readonly liveIds: ReadonlySet<string>;
  readonly launching: ReadonlySet<string>;
};

export const queuedStartableOf = ({
  open,
  liveIds,
  launching,
}: Params): ReadonlyArray<AutoDelegation> => {
  const pausedIds = new Set<string>(
    open.filter((delegation) => delegation.state === 'paused').map((delegation) => delegation.id),
  );
  const busyHelpers = new Map<string, number>();
  for (const delegation of open) {
    const parent = substepLinkOf({ request: delegation.request });
    const isLive = delegation.state !== 'accepted' && liveIds.has(delegation.id);
    if (parent !== null && (isLive || launching.has(delegation.id))) {
      busyHelpers.set(parent.delegationId, (busyHelpers.get(parent.delegationId) ?? 0) + 1);
    }
  }
  return open.filter((delegation) => {
    if (delegation.state !== 'accepted' || launching.has(delegation.id)) {
      return false;
    }
    const parent = substepLinkOf({ request: delegation.request });
    if (parent === null) {
      return true;
    }
    const busy = busyHelpers.get(parent.delegationId) ?? 0;
    if (!pausedIds.has(parent.delegationId) || busy >= AUTO_SUBSTEPS_PER_PARENT) {
      return false;
    }
    busyHelpers.set(parent.delegationId, busy + 1);
    return true;
  });
};
