import { isAutoBudgetBlock } from '@goodboy/core/auto';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

type Params = {
  readonly view: AutoTreeView;
};

const isSpent = ({ view }: Params): boolean => {
  const budget = view.budget;
  if (budget === null || budget.capUsd === null || budget.remainingUsd === null) {
    return false;
  }
  return Math.round(budget.remainingUsd * 100) <= 0;
};

const isBlockedByLimit = ({ view }: Params): boolean =>
  view.tree.phase === 'blocked' && isAutoBudgetBlock({ reason: view.tree.blockedReason });

export const isAutoPausedAtLimit = ({ view }: Params): boolean =>
  isBlockedByLimit({ view }) || (view.tree.phase !== 'blocked' && isSpent({ view }));
