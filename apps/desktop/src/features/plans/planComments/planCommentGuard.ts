import type { Agent, PlanWithCount, WorkflowRun } from '@goodboy/types';
import { isRunHeldForPlan } from '../../../store/slices/workflows/workflowPlanApproval';
import { PLAN_REVISING_REASON, type PlanRevising } from '../planRevising';

export type PlanCommentGuard = Readonly<{ canSend: boolean; reason: string | null }>;

const ALLOWED: PlanCommentGuard = { canSend: true, reason: null };

const blocked = ({ reason }: { readonly reason: string }): PlanCommentGuard => ({
  canSend: false,
  reason,
});

type Params = {
  readonly plan: PlanWithCount;
  readonly agents: ReadonlyArray<Agent>;
  readonly runs: ReadonlyArray<WorkflowRun>;
  readonly revising: PlanRevising;
};

const startedStepAfter = ({
  planner,
  agents,
}: {
  readonly planner: Agent;
  readonly agents: ReadonlyArray<Agent>;
}): Agent | null =>
  agents
    .filter(
      (agent) =>
        agent.workflowRunId === planner.workflowRunId &&
        agent.stepId !== undefined &&
        agent.parentAgentId === undefined &&
        agent.deletedAt == null &&
        agent.ordinal > planner.ordinal &&
        agent.status !== 'pending',
    )
    .sort((left, right) => left.ordinal - right.ordinal)[0] ?? null;

export const planCommentGuard = ({ plan, agents, runs, revising }: Params): PlanCommentGuard => {
  const planner = agents.find((agent) => agent.id === plan.agentId);
  if (planner === undefined || planner.deletedAt != null) {
    return blocked({ reason: 'The planner is gone, so comments cannot be sent.' });
  }
  if (revising.kind === 'revising') {
    return blocked({ reason: PLAN_REVISING_REASON });
  }
  if (plan.status === 'consumed' || plan.consumptionCount > 0) {
    return blocked({ reason: 'This plan already ran. Comments cannot change it.' });
  }
  if (plan.status !== 'active') {
    return blocked({ reason: 'This plan was replaced. Comments cannot change it.' });
  }
  if (planner.status === 'running') {
    return blocked({ reason: 'The planner is still working. Send once it finishes.' });
  }
  if (planner.stepId === undefined || planner.workflowRunId === undefined) {
    return ALLOWED;
  }
  const run = runs.find((candidate) => candidate.id === planner.workflowRunId);
  if (run !== undefined && isRunHeldForPlan({ run })) {
    return ALLOWED;
  }
  const started = startedStepAfter({ planner, agents });
  if (started === null) {
    return ALLOWED;
  }
  return blocked({
    reason: `The next step (${started.name}) already started. Comments cannot change the plan.`,
  });
};
