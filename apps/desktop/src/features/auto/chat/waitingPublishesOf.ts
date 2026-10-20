import { publishOfResult } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export type WaitingPublish = Readonly<{
  delegationId: string;
  branch: string;
}>;

export const waitingPublishesOf = ({ delegations }: Params): ReadonlyArray<WaitingPublish> =>
  delegations.flatMap((delegation) => {
    if (delegation.state !== 'settled') {
      return [];
    }
    const publish = publishOfResult({ result: delegation.result });
    if (publish === null || publish.state !== 'awaiting_confirm') {
      return [];
    }
    return [{ delegationId: delegation.id, branch: publish.branch ?? 'the branch' }];
  });
