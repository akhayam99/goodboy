import type { TelemetryRecord, WorkflowRunId } from '@goodboy/types';

type RunSpendParams = {
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly workflowRunId: WorkflowRunId;
};

export const runSpendUsd = ({ records, workflowRunId }: RunSpendParams): number => {
  let sum = 0;
  for (const record of records) {
    if (record.attributionStatus !== 'attributed' || record.workflowRunId !== workflowRunId) {
      continue;
    }
    sum += record.estimatedCostUsd;
  }
  return sum;
};
