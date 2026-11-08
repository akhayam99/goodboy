import type { AutoDelegation, AutoOutboxRow } from '@goodboy/db';
import { isAutoReturnDecided } from '../../../../features/auto/isAutoReturnDecided';
import { declinedTargetsOfRow } from './declinedTargetsOfRow';
import { returnIdsOfRow } from './returnIdsOfRow';

export type UndecidedReturn = Readonly<{
  row: AutoOutboxRow;
  delegation: AutoDelegation;
}>;

export type UndecidedReturnsParams = Readonly<{
  rows: ReadonlyArray<AutoOutboxRow>;
  delegations: ReadonlyArray<AutoDelegation>;
}>;

export const undecidedReturnsOf = ({
  rows,
  delegations,
}: UndecidedReturnsParams): ReadonlyArray<UndecidedReturn> => {
  const seen = new Set<string>();
  return rows.flatMap((row) =>
    [...returnIdsOfRow({ row }), ...declinedTargetsOfRow({ row, delegations })].flatMap(
      (returnOf): ReadonlyArray<UndecidedReturn> => {
        const delegation = delegations.find((candidate) => candidate.id === returnOf);
        if (
          delegation === undefined ||
          seen.has(returnOf) ||
          delegation.state !== 'settled' ||
          delegation.outcome !== 'blocked'
        ) {
          return [];
        }
        seen.add(returnOf);
        return isAutoReturnDecided({ delegation, delegations }) ? [] : [{ row, delegation }];
      },
    ),
  );
};
