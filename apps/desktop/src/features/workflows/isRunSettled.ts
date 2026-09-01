import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { isWorkflowComplete } from '@goodboy/core';

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow | null;
  readonly agents: ReadonlyArray<Agent>;
};

export const isRunSettled = ({ run, workflow, agents }: Params): boolean => {
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  if (workflow == null) {
    return false;
  }
  return isWorkflowComplete(workflow, agents);
};
