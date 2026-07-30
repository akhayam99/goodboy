import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Agent;
};

export const isWorkflowStepAgent = ({ agent }: Params): boolean =>
  agent.workflowRunId != null && agent.stepId != null;
