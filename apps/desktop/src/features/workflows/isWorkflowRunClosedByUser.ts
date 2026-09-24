import type { WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: WorkflowRun;
};

export const isWorkflowRunClosedByUser = ({ run }: Params): boolean =>
  run.orchestrationStop?.kind === 'closed';
