import type { HistoryRun } from '../../../store/slices/history/types';

type Params = {
  readonly historyRun: HistoryRun | null;
};

export const rebaseProgressTextOf = ({ historyRun }: Params): string => {
  const progress = historyRun?.progress ?? null;
  if (progress?.stage === 'step' && progress.index > 0) {
    return `Replaying ${progress.index} of ${progress.total}`;
  }
  return 'Rebasing';
};
