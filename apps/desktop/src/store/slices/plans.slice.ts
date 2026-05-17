import {
  deletePlan as invokeDeletePlan,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
  setPlanBody as invokeSetPlanBody,
  setPlanStatus as invokeSetPlanStatus,
} from '../../features/plans/plans';
import type { SessionId, PlanId, PlanStatus } from '@kay-am/types';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

export function createPlansSlice(set: SetFn, get: GetFn) {
  return {
    loadSessionPlans: async (sessionId: SessionId) => {
      const plans = await invokeListPlansForSession(sessionId);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: plans },
      }));
    },

    setPlanStatus: async (sessionId: SessionId, planId: PlanId, status: PlanStatus) => {
      await invokeSetPlanStatus(planId, status);
      const refreshed = await invokeListPlansForSession(sessionId);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
      }));
    },

    updatePlanBody: async (sessionId: SessionId, planId: PlanId, title: string, bodyMd: string) => {
      await invokeSetPlanBody(planId, title, bodyMd);
      const refreshed = await invokeListPlansForSession(sessionId);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
      }));
    },

    deletePlan: async (sessionId: SessionId, planId: PlanId) => {
      await invokeDeletePlan(planId);
      const refreshed = await invokeListPlansForSession(sessionId);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
      }));
    },

    abandonPlan: async (sessionId: SessionId, planId: PlanId) => {
      await invokeSetPlanStatus(planId, 'superseded');
      const refreshed = await invokeListPlansForSession(sessionId);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
      }));
    },

    loadConsumptionsForPlan: async (planId: PlanId) => {
      const items = await invokeListConsumptionsForPlan(planId);
      set((state) => ({
        planConsumptions: { ...state.planConsumptions, [planId]: items },
      }));
    },

    runPlan: async (sessionId: SessionId, planId: PlanId) => {
      await get().spawnAgent(sessionId, { triggeredPlanId: planId });
    },
  };
}
