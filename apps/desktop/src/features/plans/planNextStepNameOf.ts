import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { nextPendingStepAgentOf } from './nextPendingStepAgentOf';

type Params = {
  readonly run: Pick<WorkflowRun, 'id' | 'workflowId' | 'autoRun' | 'executionMode'> | null;
  readonly templates: ReadonlyArray<Workflow>;
  readonly agents: ReadonlyArray<Agent>;
};

export const planNextStepNameOf = ({ run, templates, agents }: Params): string | null => {
  if (run === null || run.autoRun === true || run.executionMode === 'dynamic') {
    return null;
  }
  return nextPendingStepAgentOf({ run, templates, agents })?.name ?? null;
};
