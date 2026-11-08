import type { AutoDelegation } from '@goodboy/db';
import { delegationMountIdOf } from './delegationMountIdOf';

type Params = {
  readonly delegation: AutoDelegation;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

const isRetried = ({ delegation, delegations }: Params): boolean =>
  delegations.some((later) => later.retryOf === delegation.id);

type StartedParams = {
  readonly delegation: AutoDelegation;
};

const hasStarted = ({ delegation }: StartedParams): boolean => {
  if (delegation.state === 'awaiting_confirm') {
    return false;
  }
  return !(
    delegation.state === 'settled' &&
    delegation.outcome === 'stopped' &&
    delegation.reason === 'declined'
  );
};

const isSuperseded = ({ delegation, delegations }: Params): boolean => {
  if (delegation.state !== 'settled' || delegation.outcome === 'completed') {
    return false;
  }
  const mountId = delegationMountIdOf({ delegation });
  if (mountId === null) {
    return false;
  }
  const isAnyRole = delegation.outcome === 'blocked';
  const returnedAt = delegation.settledAt ?? delegation.createdAt;
  return delegations.some(
    (later) =>
      later.id !== delegation.id &&
      !later.isAdopted &&
      hasStarted({ delegation: later }) &&
      (isAnyRole || later.role === delegation.role) &&
      later.createdAt > returnedAt &&
      delegationMountIdOf({ delegation: later }) === mountId,
  );
};

export const isAutoDelegationReplaced = ({ delegation, delegations }: Params): boolean =>
  isRetried({ delegation, delegations }) || isSuperseded({ delegation, delegations });
