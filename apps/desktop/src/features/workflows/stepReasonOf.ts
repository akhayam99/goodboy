import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { decisionEntries } from './decisionEntries';

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agent: Agent;
  readonly stepAgent: Agent | null;
};

export const stepReasonOf = ({ run, workflow, agent, stepAgent }: Params): string => {
  if (stepAgent === null || stepAgent.id !== agent.id) {
    return '';
  }
  const decision = decisionEntries({ run, steps: workflow.steps }).decisions.find(
    (entry) => entry.stepId === stepAgent.stepId,
  );
  const own = workflow.steps.find((step) => step.id === stepAgent.stepId)?.orchestratorReason;
  return (decision?.reason ?? own ?? '').trim();
};
