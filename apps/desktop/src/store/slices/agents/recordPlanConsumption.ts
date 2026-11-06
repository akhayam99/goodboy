import type { AgentId, PlanId, SessionId } from '@goodboy/types';
import {
  addPlanConsumption as invokeAddPlanConsumption,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
} from '../../../features/plans/plans';
import { sessionReads } from '../../runtime/state-writes/sessionReads';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  planId: PlanId;
  agentId: AgentId;
}>;

export const recordPlanConsumption = async ({
  set,
  sessionId,
  planId,
  agentId,
}: Params): Promise<void> => {
  await invokeAddPlanConsumption(planId, agentId);
  const plansRead = sessionReads.plans({ sessionId });
  const refreshedPlans = await invokeListPlansForSession(sessionId);
  const consumptions = await invokeListConsumptionsForPlan(planId);
  set((s) => ({
    ...(plansRead.isCurrent() && {
      sessionPlans: { ...s.sessionPlans, [sessionId]: refreshedPlans },
    }),
    planConsumptions: { ...s.planConsumptions, [planId]: consumptions },
  }));
};
