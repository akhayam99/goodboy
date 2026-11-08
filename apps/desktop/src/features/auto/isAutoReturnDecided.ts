import type { AutoDelegation } from '@goodboy/db';
import { delegationReleaseOf } from './delegationReleaseOf';
import { delegationReplacesOf } from './delegationReplacesOf';

type Later = Pick<AutoDelegation, 'id' | 'retryOf' | 'request' | 'state' | 'outcome' | 'reason'>;

type Params = {
  readonly delegation: Pick<AutoDelegation, 'id' | 'request'>;
  readonly delegations: ReadonlyArray<Later>;
};

type DeclinedParams = {
  readonly later: Later;
};

const isDeclined = ({ later }: DeclinedParams): boolean =>
  later.state === 'settled' && later.outcome === 'stopped' && later.reason === 'declined';

export const isAutoReturnDecided = ({ delegation, delegations }: Params): boolean =>
  delegationReleaseOf({ delegation }) !== null ||
  delegations.some(
    (later) =>
      later.id !== delegation.id &&
      !isDeclined({ later }) &&
      (later.retryOf === delegation.id ||
        delegationReplacesOf({ delegation: later }) === delegation.id),
  );
