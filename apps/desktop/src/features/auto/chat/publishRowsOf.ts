import { publishOfResult, type ResultPublish } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import { publishLineOf, type PublishLine } from './publishLineOf';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export type PublishRow = Readonly<{
  delegationId: string;
  branch: string;
  line: PublishLine;
}>;

type AskedParams = {
  readonly publish: ResultPublish;
};

const isAskedOf = ({ publish }: AskedParams): boolean =>
  publish.mode === 'force' &&
  (publish.state === 'awaiting_confirm' ||
    publish.state === 'pushing' ||
    publish.state === 'declined' ||
    publish.isConfirmed);

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
        line: publishLineOf({ publish }),
      },
    ];
  });
