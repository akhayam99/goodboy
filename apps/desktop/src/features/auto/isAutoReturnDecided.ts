import type { AutoDelegation } from '@goodboy/db';
import { recordField } from './chat/readJson';
import { delegationReleaseOf } from './delegationReleaseOf';
import { delegationReplacesOf } from './delegationReplacesOf';
import { isAutoDelegationSuperseded } from './isAutoDelegationSuperseded';

type Params = {
  readonly delegation: AutoDelegation;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type DeclinedParams = {
  readonly later: AutoDelegation;
};

const isDeclined = ({ later }: DeclinedParams): boolean =>
  later.state === 'settled' && later.outcome === 'stopped' && later.reason === 'declined';

const isLegacyReturnSuperseded = ({ delegation, delegations }: Params): boolean =>
  delegation.outcome === 'blocked' &&
  recordField({ source: delegation.result, key: 'returned' }) === null &&
  isAutoDelegationSuperseded({ delegation, delegations, isAnyRole: true });

export const isAutoReturnDecided = ({ delegation, delegations }: Params): boolean =>
  delegationReleaseOf({ delegation }) !== null ||
  delegations.some(
    (later) =>
      later.id !== delegation.id &&
      !isDeclined({ later }) &&
      (later.retryOf === delegation.id ||
        delegationReplacesOf({ delegation: later }) === delegation.id),
  ) ||
  isLegacyReturnSuperseded({ delegation, delegations });
