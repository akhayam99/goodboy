import type { UpdatePlanBodyResult } from '@goodboy/db';
import type { PlanId, SessionId } from '@goodboy/types';
import { setPlanBodyIfRevision as invokeSetPlanBodyIfRevision } from '../../../features/plans/plans';
import { refreshSessionArtifactsAndPlans } from '../artifacts/refresh';
import type { SetFn } from './types';

export const updatePlanBody = (set: SetFn) => {
  return async (
    sessionId: SessionId,
    planId: PlanId,
    title: string,
    bodyMd: string,
    expectedRevision: number,
  ): Promise<UpdatePlanBodyResult> => {
    const result = await invokeSetPlanBodyIfRevision(planId, title, bodyMd, expectedRevision);
    if (result.kind === 'saved') {
      await refreshSessionArtifactsAndPlans(set, sessionId);
    }
    return result;
  };
};
