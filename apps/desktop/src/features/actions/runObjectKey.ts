import type { WorkflowRunId } from '@goodboy/types';

type Params = {
  readonly runId: WorkflowRunId;
};

export const runObjectKey = ({ runId }: Params): string => `workflowRun:${runId}`;

export const runTitleAnchorKey = ({ runId }: Params): string => `workflow-run-title:${runId}`;
