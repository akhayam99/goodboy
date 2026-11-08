import type { AutoDelegation, AutoOutboxRow } from '@goodboy/db';
import { isAutoReturnDecided } from '../../../../features/auto/isAutoReturnDecided';
import { returnOfRow } from './returnOfRow';

export type UndecidedReturnRowsParams = Readonly<{
  rows: ReadonlyArray<AutoOutboxRow>;
  delegations: ReadonlyArray<AutoDelegation>;
}>;

export const undecidedReturnRowsOf = ({
  rows,
  delegations,
}: UndecidedReturnRowsParams): ReadonlyArray<AutoOutboxRow> => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const returnOf = returnOfRow({ row });
    const delegation = delegations.find((candidate) => candidate.id === returnOf);
    if (returnOf === null || delegation === undefined || seen.has(returnOf)) {
      return false;
    }
    seen.add(returnOf);
    return !isAutoReturnDecided({ delegation, delegations });
  });
};
