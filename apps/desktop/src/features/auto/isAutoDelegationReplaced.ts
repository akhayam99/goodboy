import type { AutoDelegation } from '@goodboy/db';
import { isAutoDelegationSuperseded } from './isAutoDelegationSuperseded';
import { isAutoReturnDecided } from './isAutoReturnDecided';

type Params = {
  readonly delegation: AutoDelegation;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export const isAutoDelegationReplaced = ({ delegation, delegations }: Params): boolean => {
  if (isAutoReturnDecided({ delegation, delegations })) {
    return true;
  }
  if (delegation.outcome === 'blocked') {
    return false;
  }
  return isAutoDelegationSuperseded({ delegation, delegations, isAnyRole: false });
};
