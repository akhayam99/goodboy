import type { AutoDelegation } from '@goodboy/db';
import { delegationMountIdOf } from './delegationMountIdOf';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type BlockedParams = {
  readonly blocked: AutoDelegation;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type DelegationParams = {
  readonly delegation: AutoDelegation;
};

const isBlocked = ({ delegation }: DelegationParams): boolean =>
  delegation.state === 'settled' && delegation.outcome === 'blocked';

const isCompletedAfter = ({ blocked, delegations }: BlockedParams): boolean => {
  const endedAt = blocked.settledAt ?? blocked.createdAt;
  const mountId = delegationMountIdOf({ delegation: blocked });
  return delegations.some(
    (later) =>
      later.id !== blocked.id &&
      later.state === 'settled' &&
      later.outcome === 'completed' &&
      later.role === blocked.role &&
      later.createdAt > endedAt &&
      delegationMountIdOf({ delegation: later }) === mountId,
  );
};

export const isAutoBlockRecovered = ({ delegations }: Params): boolean => {
  const blocked = delegations.filter((delegation) => isBlocked({ delegation }));
  return (
    blocked.length > 0 &&
    blocked.every((delegation) => isCompletedAfter({ blocked: delegation, delegations }))
  );
};
