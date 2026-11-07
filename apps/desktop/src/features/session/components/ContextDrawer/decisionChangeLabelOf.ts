import type { SessionDecision } from '@goodboy/types';
import type { DecisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';

type Params = {
  readonly row: SessionDecision;
  readonly changes: DecisionChangesSince;
};

type ListParams = {
  readonly list: ReadonlyArray<SessionDecision>;
  readonly number: number;
};

const isListed = ({ list, number }: ListParams): boolean =>
  list.some((changed) => changed.number === number);

export const decisionChangeLabelOf = ({ row, changes }: Params): string | null => {
  const { number } = row;
  if (isListed({ list: changes.added, number })) {
    return 'Added';
  }
  if (isListed({ list: changes.removed, number })) {
    return row.replacedBy === null ? 'Withdrawn' : `Replaced by ${row.replacedBy}`;
  }
  if (isListed({ list: changes.reworded, number })) {
    return 'Reworded';
  }
  return null;
};
