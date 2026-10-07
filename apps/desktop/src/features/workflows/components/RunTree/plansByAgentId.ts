import type { PlanWithCount } from '@goodboy/types';

type Params = {
  readonly plans: ReadonlyArray<PlanWithCount>;
};

const SHOWN_STATUSES: ReadonlySet<PlanWithCount['status']> = new Set<PlanWithCount['status']>([
  'active',
  'consumed',
]);

export const plansByAgentId = ({ plans }: Params): ReadonlyMap<string, PlanWithCount> => {
  const byAgentId = new Map<string, PlanWithCount>();
  for (const plan of plans) {
    if (!SHOWN_STATUSES.has(plan.status)) {
      continue;
    }
    const known = byAgentId.get(plan.agentId);
    if (known === undefined || known.updatedAt.localeCompare(plan.updatedAt) < 0) {
      byAgentId.set(plan.agentId, plan);
    }
  }
  return byAgentId;
};
