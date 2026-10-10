import { classifyWorkflowChain, runsForWorkflowRun } from '@goodboy/core';
import type { Agent, PlanWithCount, Workflow, WorkflowRun } from '@goodboy/types';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';
import { classifyStep, kindConsumesPlan } from '../session/agent-kind';

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'agentId' | 'workflowRunId'>;
  agents: ReadonlyArray<Agent>;
  runs: ReadonlyArray<WorkflowRun>;
  templates: ReadonlyArray<Workflow>;
}>;

type RunParams = Readonly<{ run: WorkflowRun }>;

const isAlive = ({ run }: RunParams): boolean =>
  run.discardedAt == null &&
  run.orchestrationOutcome !== 'done' &&
  run.orchestrationStop?.kind !== 'closed';

type NextStepParams = Readonly<{
  run: WorkflowRun;
  agents: ReadonlyArray<Agent>;
  templates: ReadonlyArray<Workflow>;
}>;

const hasNextStepForPlan = ({ run, agents, templates }: NextStepParams): boolean => {
  const template = templates.find((candidate) => candidate.id === run.workflowId);
  if (template === undefined) {
    return false;
  }
  const stepAgents = runsForWorkflowRun(agents, run.id).filter(
    (agent) => agent.parentAgentId == null && agent.stepId != null,
  );
  const chain = classifyWorkflowChain(template, stepAgents);
  if (chain.kind !== 'step') {
    return false;
  }
  return kindConsumesPlan({ kind: classifyStep({ step: chain.step }) });
};

export const planOwnerOf = ({ plan, agents, runs, templates }: Params): WorkflowRun | null => {
  if (plan.workflowRunId != null) {
    const linked = runs.find((candidate) => candidate.id === plan.workflowRunId);
    if (linked !== undefined) {
      return isAlive({ run: linked }) ? linked : null;
    }
  }
  const creator = agents.find((agent) => agent.id === plan.agentId);
  if (creator === undefined || creator.stepId == null || creator.workflowRunId == null) {
    return null;
  }
  const run = runs.find((candidate) => candidate.id === creator.workflowRunId);
  if (run === undefined || !isAlive({ run })) {
    return null;
  }
  if (isRunHeldForPlan({ run }) || run.rulesSnapshot?.planApproved === true) {
    return run;
  }
  return hasNextStepForPlan({ run, agents, templates }) ? run : null;
};
