import type { AutoDelegation } from '@goodboy/db';
import { textField } from './chat/readJson';
import { delegationMountIdOf } from './delegationMountIdOf';
import { isAutoReturnDecided } from './isAutoReturnDecided';

type Params = {
  readonly delegation: AutoDelegation;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type StartedParams = {
  readonly delegation: AutoDelegation;
};

const hasStarted = ({ delegation }: StartedParams): boolean => {
  if (delegation.state === 'awaiting_confirm') {
    return false;
  }
  if (delegation.state !== 'settled' || delegation.outcome !== 'stopped') {
    return true;
  }
  if (delegation.reason === 'declined') {
    return false;
  }
  return textField({ source: delegation.result, key: 'attemptId' }) !== null;
};

const isSuperseded = ({ delegation, delegations }: Params): boolean => {
  if (delegation.state !== 'settled' || delegation.outcome === 'completed') {
    return false;
  }
  const mountId = delegationMountIdOf({ delegation });
  if (mountId === null) {
    return false;
  }
  const endedAt = delegation.settledAt ?? delegation.createdAt;
  return delegations.some(
    (later) =>
      later.id !== delegation.id &&
      !later.isAdopted &&
      hasStarted({ delegation: later }) &&
      later.role === delegation.role &&
      later.createdAt > endedAt &&
      delegationMountIdOf({ delegation: later }) === mountId,
  );
};

export const isAutoDelegationReplaced = ({ delegation, delegations }: Params): boolean => {
  if (isAutoReturnDecided({ delegation, delegations })) {
    return true;
  }
  if (delegation.outcome === 'blocked') {
    return false;
  }
  return isSuperseded({ delegation, delegations });
};
