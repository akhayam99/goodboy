import type { AutoDelegation } from '@goodboy/db';
import { openRoleNouns } from './openRoleNouns';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export const needsYouRoleNouns = ({ delegations }: Params): ReadonlyArray<string> =>
  openRoleNouns({
    delegations: delegations.filter(
      (delegation) =>
        !delegation.isStopping &&
        (delegation.state === 'paused' || delegation.state === 'awaiting_confirm'),
    ),
  });
