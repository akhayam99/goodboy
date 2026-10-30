import type { WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: Pick<WorkflowRun, 'spendLimitUsd' | 'rulesSnapshot'>;
};

export type RunLimitSource = 'default' | 'this run';

export const runLimitSourceOf = ({ run }: Params): RunLimitSource | null => {
  const usd = run.spendLimitUsd ?? null;
  if (usd === null) {
    return null;
  }
  const snapshot = run.rulesSnapshot;
  return snapshot?.limitSource === 'default' && snapshot.spendLimitUsd === usd
    ? 'default'
    : 'this run';
};
