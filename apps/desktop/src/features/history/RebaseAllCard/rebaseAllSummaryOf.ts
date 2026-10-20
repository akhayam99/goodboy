import type { RebaseAllRun } from '../../../store/slices/rebaseAll/types';

type SummaryParams = {
  readonly run: RebaseAllRun;
};

const settledCountOf = ({ run }: SummaryParams): number =>
  run.branches.filter((branch) => branch.state !== 'queued' && branch.state !== 'rebasing').length;

export const rebaseAllSummaryOf = ({ run }: SummaryParams): string => {
  const total = run.branches.length;
  switch (run.phase) {
    case 'running':
      return run.isAborted
        ? 'Stopping after this branch'
        : `Rebasing ${Math.min(settledCountOf({ run }) + 1, total)} of ${total}`;
    case 'handing':
      return 'Handing the rest to Auto';
    case 'handed':
      return 'Auto has the rest';
    case 'aborted':
      return 'Stopped. Finished branches stay rebased.';
    case 'done':
      return run.error ?? `${total} branches done`;
    default: {
      const exhaustive: never = run.phase;
      return exhaustive;
    }
  }
};
