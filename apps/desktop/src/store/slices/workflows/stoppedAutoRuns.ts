import type { WorkflowRunId } from '@goodboy/types';

type Params = Readonly<{
  workflowRunId: WorkflowRunId;
}>;

const runs = new Set<WorkflowRunId>();

export const stoppedAutoRuns = {
  remember: ({ workflowRunId }: Params): void => {
    runs.add(workflowRunId);
  },
  has: ({ workflowRunId }: Params): boolean => runs.has(workflowRunId),
  forget: ({ workflowRunId }: Params): void => {
    runs.delete(workflowRunId);
  },
};
