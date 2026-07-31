import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { isWorkflowComplete } from '@goodboy/core';

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
};

export const isWorkflowRunComplete = ({ run, workflow, agents }: Params): boolean => {
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  return workflow.steps.length > 0 && isWorkflowComplete(workflow, agents);
};
