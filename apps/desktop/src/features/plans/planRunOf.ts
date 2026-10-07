import { classifyWorkflowChain, runsForWorkflowRun } from '@goodboy/core';
import type { Agent, PlanWithCount, Workflow, WorkflowRun } from '@goodboy/types';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';
import { classifyStep, kindConsumesPlan } from '../session/agent-kind';

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'agentId'>;
  agents: ReadonlyArray<Agent>;
  runs: ReadonlyArray<WorkflowRun>;
  templates: ReadonlyArray<Workflow>;
}>;

export const planRunOf = ({ plan, agents, runs, templates }: Params): WorkflowRun | null => {
  const creator = agents.find((agent) => agent.id === plan.agentId);
  if (creator === undefined || creator.stepId == null || creator.workflowRunId == null) {
    return null;
  }
  const run = runs.find((candidate) => candidate.id === creator.workflowRunId);
  if (run === undefined) {
    return null;
  }
  if (isRunHeldForPlan({ run })) {
    return run;
  }
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
  return kindConsumesPlan({ kind: classifyStep({ step: chain.step }) }) ? run : null;
};
