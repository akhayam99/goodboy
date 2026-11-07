import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
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
  view.tree.phase === 'blocked' &&
  (view.tree.blockedReason === AUTO_BLOCK_TEXT.budget ||
    view.tree.blockedReason === AUTO_BLOCK_TEXT.limit_wall_clock);

export const isAutoPausedAtLimit = ({ view }: Params): boolean =>
  isBlockedByLimit({ view }) || (view.tree.phase !== 'blocked' && isSpent({ view }));
