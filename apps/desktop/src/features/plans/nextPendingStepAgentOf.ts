import { classifyWorkflowChain, runsForWorkflowRun } from '@goodboy/core/workflows';
import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: Pick<WorkflowRun, 'id' | 'workflowId'>;
  readonly templates: ReadonlyArray<Workflow>;
  readonly agents: ReadonlyArray<Agent>;
};

export const nextPendingStepAgentOf = ({ run, templates, agents }: Params): Agent | null => {
  const template = templates.find((candidate) => candidate.id === run.workflowId);
  if (template === undefined) {
    return null;
  }
  const stepAgents = runsForWorkflowRun(agents, run.id).filter(
    (agent) => agent.parentAgentId == null && agent.stepId != null,
  );
  const chain = classifyWorkflowChain(template, stepAgents);
  if (chain.kind !== 'step') {
    return null;
  }
  return (
    stepAgents.find((agent) => agent.stepId === chain.step.id && agent.status === 'pending') ?? null
  );
};
