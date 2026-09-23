import type { WorkflowRunId } from '@goodboy/types';

type Params = {
  readonly workflowRunId: WorkflowRunId;
};

const restartRequests = new Map<WorkflowRunId, number>();

export const requestDecisionRestart = ({ workflowRunId }: Params): void => {
  restartRequests.set(workflowRunId, (restartRequests.get(workflowRunId) ?? 0) + 1);
};

export const decisionRestartMark = ({ workflowRunId }: Params): number =>
  restartRequests.get(workflowRunId) ?? 0;
