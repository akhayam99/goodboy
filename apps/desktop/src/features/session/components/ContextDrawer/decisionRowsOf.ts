import type { SessionDecision } from '@goodboy/types';
import type { DecisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';

type Params = {
  readonly decisions: ReadonlyArray<SessionDecision>;
  readonly changes: DecisionChangesSince;
  readonly pendingRemovals: ReadonlySet<number>;
};

export const decisionRowsOf = ({ decisions, changes, pendingRemovals }: Params) => {
  const order = new Map(
    [...changes.added, ...changes.removed, ...changes.reworded].map((row, index) => [
      row.number,
      index,
    ]),
  );
  const closed = decisions
    .filter(
      (row) =>
        row.status !== 'active' && !pendingRemovals.has(row.number) && !order.has(row.number),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const activeRows = decisions
    .filter(
      (row) => row.status === 'active' || pendingRemovals.has(row.number) || order.has(row.number),
    )
    .sort((left, right) => {
      const changedOrder =
        (order.get(left.number) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.number) ?? Number.MAX_SAFE_INTEGER);
      if (changedOrder !== 0) {
        return changedOrder;
      }
      return right.number - left.number;
    });
  return { closed, activeRows };
};
