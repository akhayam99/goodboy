import type { AutoDelegation } from '@goodboy/db';
import { delegationReleaseOf } from './delegationReleaseOf';
import { delegationReplacesOf } from './delegationReplacesOf';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'id' | 'request'>;
  readonly delegations: ReadonlyArray<Pick<AutoDelegation, 'id' | 'retryOf' | 'request'>>;
};

export const isAutoReturnDecided = ({ delegation, delegations }: Params): boolean =>
  delegationReleaseOf({ delegation }) !== null ||
  delegations.some(
    (later) =>
      later.id !== delegation.id &&
      (later.retryOf === delegation.id ||
        delegationReplacesOf({ delegation: later }) === delegation.id),
  );
