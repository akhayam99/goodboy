import type { SessionId } from '@goodboy/types';
import { listPlansForSession as invokeListPlansForSession } from '../../../features/plans/plans';
import { sessionReads } from '../../runtime/state-writes/sessionReads';
import type { SetFn } from './types';

export const loadSessionPlans = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const plansRead = sessionReads.plans({ sessionId });
    const plans = await invokeListPlansForSession(sessionId);
    set((state) =>
      plansRead.isCurrent() ? { sessionPlans: { ...state.sessionPlans, [sessionId]: plans } } : {},
    );
  };
};
