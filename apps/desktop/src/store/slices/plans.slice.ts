import {
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
  setPlanBody as invokeSetPlanBody,
  setPlanStatus as invokeSetPlanStatus,
} from '../../features/plans/plans';
import type { SessionId, PlanId, PlanStatus } from '@goodboy/types';
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

    // Soft delete: status flips to 'discarded'. The row stays in the DB so
    // the user can restore it with a second click. Hard deletion lives at
    // the DB query layer for admin use only.
    deletePlan: async (sessionId: SessionId, planId: PlanId) => {
      await invokeSetPlanStatus(planId, 'discarded');
      const refreshed = await invokeListPlansForSession(sessionId);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
      }));
    },

    restorePlan: async (sessionId: SessionId, planId: PlanId) => {
      await invokeSetPlanStatus(planId, 'active');
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

    // Force the spawned agent to be an implementer so spawnAgent injects the
    // plan body into the kickoff prompt. Without kindOverride the agent
    // defaults to 'generic' and the plan section is silently dropped (the
    // implementer branch in spawnAgent is the only one that builds it).
    runPlan: async (sessionId: SessionId, planId: PlanId) => {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
    },
  };
}
