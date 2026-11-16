import type { SummaryStatus } from './summaryStatusOf';

type Params = {
  readonly status: SummaryStatus;
};

export const summaryStatusWordOf = ({ status }: Params): string => {
  if (status.tone === 'blocked') {
    const count = status.blockers.length;
    return count === 1 ? '1 blocker' : `${count} blockers`;
  }
  if (status.tone === 'working') {
    return status.stepCount === 1 ? '1 step left' : `${status.stepCount} steps left`;
  }
  return 'No steps left';
};
