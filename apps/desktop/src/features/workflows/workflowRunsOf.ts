import type { WorkflowRunHistoryRow } from '@goodboy/db';
import type { WorkflowId } from '@goodboy/types';

type Params = {
  readonly runs: ReadonlyArray<WorkflowRunHistoryRow>;
  readonly workflowId: WorkflowId;
};

export const workflowRunsOf = ({
  runs,
  workflowId,
}: Params): ReadonlyArray<WorkflowRunHistoryRow> =>
  runs.filter((run) => run.workflowId === workflowId);
