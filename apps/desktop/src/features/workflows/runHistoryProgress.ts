import type { WorkflowRunHistoryRow } from '@goodboy/db';

type Params = {
  readonly run: WorkflowRunHistoryRow;
};

export const runHistoryProgress = ({ run }: Params): string => {
  if (run.startedSteps === 0) {
    return '';
  }
  if (run.executionMode === 'dynamic' || run.stepCount === 0) {
    return `Step ${run.startedSteps}`;
  }
  return `Step ${Math.min(run.startedSteps, run.stepCount)} of ${run.stepCount}`;
};
