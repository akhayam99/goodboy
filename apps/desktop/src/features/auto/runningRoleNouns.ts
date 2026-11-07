import type { AutoDelegation } from '@goodboy/db';
import { openRoleNouns } from './openRoleNouns';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export const runningRoleNouns = ({ delegations }: Params): ReadonlyArray<string> =>
  openRoleNouns({
    delegations: delegations.filter(
      (delegation) => delegation.state === 'running' || delegation.state === 'starting',
    ),
  });
