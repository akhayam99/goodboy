import type { Agent, PlanWithCount, WorkflowRunId } from '@goodboy/types';

type Params = Readonly<{
  plans: ReadonlyArray<PlanWithCount>;
  agents: ReadonlyArray<Agent>;
  runId: WorkflowRunId;
}>;

export const runPlanOf = ({ plans, agents, runId }: Params): PlanWithCount | null => {
  let found: PlanWithCount | null = null;
  for (const plan of plans) {
    if (plan.status !== 'active') {
      continue;
    }
    const planRunId =
      plan.workflowRunId ?? agents.find((agent) => agent.id === plan.agentId)?.workflowRunId;
    if (planRunId !== runId) {
      continue;
    }
    if (found === null || plan.updatedAt >= found.updatedAt) {
      found = plan;
    }
  }
  return found;
};
