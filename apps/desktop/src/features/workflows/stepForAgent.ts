import type { Agent, Step, Workflow, WorkflowRun } from '@goodboy/types';

type Params = {
  readonly agent: Agent;
  readonly workflowRuns: ReadonlyArray<WorkflowRun>;
  readonly workflows: ReadonlyArray<Workflow>;
};

export const stepForAgent = ({ agent, workflowRuns, workflows }: Params): Step | null => {
  if (agent.stepId == null || agent.workflowRunId == null) {
    return null;
  }
  const run = workflowRuns.find((candidate) => candidate.id === agent.workflowRunId);
  if (run == null) {
    return null;
  }
  const workflow = workflows.find((candidate) => candidate.id === run.workflowId);
  if (workflow == null) {
    return null;
  }
  return workflow.steps.find((step) => step.id === agent.stepId) ?? null;
};
