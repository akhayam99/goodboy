import type { SessionId, PlanWithCount, PlanId, PlanConsumption } from '@goodboy/types';

export type PlansState = {
  readonly sessionPlans: Readonly<Record<SessionId, ReadonlyArray<PlanWithCount>>>;
  readonly planConsumptions: Readonly<Record<PlanId, ReadonlyArray<PlanConsumption>>>;
};

export const plansInitialState: PlansState = {
  sessionPlans: {},
  planConsumptions: {},
};
