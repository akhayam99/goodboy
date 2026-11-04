import type { Agent, WorkflowRunId } from '@goodboy/types';
import { notFinishedKindOf } from '@goodboy/core/workflows';

type Params = {
  readonly runs: ReadonlyArray<Agent>;
  readonly workflowRunId: WorkflowRunId | undefined;
};

export const composeMissingStepsSection = ({ runs, workflowRunId }: Params): string => {
  if (workflowRunId === undefined) {
    return '';
  }
  const lines = runs
    .filter((agent) => agent.workflowRunId === workflowRunId && agent.parentAgentId == null)
    .filter((agent) => notFinishedKindOf({ agent }) !== null)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((agent) => `- ${agent.name}: ${agent.outputSummary ?? ''}`);
  if (lines.length === 0) {
    return '';
  }
  return `**Not finished** these earlier steps did not finish and were skipped, so their work may be missing:\n${lines.join('\n')}`;
};
