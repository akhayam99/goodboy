import type { SessionBudget } from '@goodboy/types';

type Params = {
  readonly budget: SessionBudget | undefined;
};

export const pausingSessionCapOf = ({ budget }: Params): number | null => {
  if (budget === undefined || budget.onExceed !== 'pause') {
    return null;
  }
  return budget.softCapUsd;
};
