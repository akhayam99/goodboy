import { AUTO_TREE_LIMITS, storedResultOf, type WaitingReturn } from '@goodboy/core/auto';
import { listAutoDelegations, listAutoOutbox, type AutoTree, type Database } from '@goodboy/db';
import { isAutoReturnDecided } from '../../../../features/auto/isAutoReturnDecided';
import { rebriefCountOf } from './rebriefCountOf';
import { returnCountOf } from './returnCountOf';
import { returnOfRow } from './returnOfRow';

export type WaitingReturnsParams = Readonly<{
  db: Database;
  tree: Pick<AutoTree, 'id' | 'generation'>;
}>;

export const waitingReturnsOf = async ({
  db,
  tree,
}: WaitingReturnsParams): Promise<ReadonlyArray<WaitingReturn>> => {
  const rows = await listAutoOutbox({ db, treeId: tree.id, kinds: ['results'] });
  const returned = new Set(
    rows
      .filter((row) => row.generation === tree.generation && row.state !== 'dropped')
      .flatMap((row) => {
        const returnOf = returnOfRow({ row });
        return returnOf === null ? [] : [returnOf];
      }),
  );
  if (returned.size === 0) {
    return [];
  }
  const delegations = await listAutoDelegations({ db, treeId: tree.id });
  return delegations.flatMap((delegation): ReadonlyArray<WaitingReturn> => {
    if (
      !returned.has(delegation.id) ||
      delegation.state !== 'settled' ||
      delegation.outcome !== 'blocked' ||
      isAutoReturnDecided({ delegation, delegations })
    ) {
      return [];
    }
    const result = storedResultOf({ value: delegation.result });
    if (result === null) {
      return [];
    }
    const returns = returnCountOf({ delegation, delegations });
    return [
      {
        result,
        returns,
        isClosed: returns > AUTO_TREE_LIMITS.returnsPerDelegation,
        isRebriefClosed:
          rebriefCountOf({ delegation, delegations }) >= AUTO_TREE_LIMITS.rebriefsPerTask,
      },
    ];
  });
};
