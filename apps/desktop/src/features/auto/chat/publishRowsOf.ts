import { publishOfResult, type ResultPublish } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import { publishLineOf, type PublishLine } from './publishLineOf';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export type PublishRow = Readonly<{
  delegationId: string;
  branch: string;
  isForce: boolean;
  line: PublishLine;
}>;

type AskedParams = {
  readonly publish: ResultPublish;
};

const isForceAskedOf = ({ publish }: AskedParams): boolean =>
  publish.state === 'awaiting_confirm' ||
  publish.state === 'pushing' ||
  publish.state === 'declined' ||
  publish.isConfirmed ||
  publish.startedAt !== null ||
  (publish.state === 'failed' && publish.tries > 0);

const isHeldPushOf = ({ publish }: AskedParams): boolean =>
  publish.state === 'awaiting_confirm' || publish.state === 'declined' || publish.isConfirmed;

const isAskedOf = ({ publish }: AskedParams): boolean => {
  if (publish.mode === 'force') {
    return isForceAskedOf({ publish });
  }
  return publish.mode === 'push' && isHeldPushOf({ publish });
};

export const publishRowsOf = ({ delegations }: Params): ReadonlyArray<PublishRow> =>
  delegations.flatMap((delegation) => {
    if (delegation.state !== 'settled') {
      return [];
    }
    const publish = publishOfResult({ result: delegation.result });
    if (publish === null || !isAskedOf({ publish })) {
      return [];
    }
    return [
      {
        delegationId: delegation.id,
        branch: publish.branch ?? 'the branch',
        isForce: publish.mode === 'force',
        line: publishLineOf({ publish }),
      },
    ];
  });
