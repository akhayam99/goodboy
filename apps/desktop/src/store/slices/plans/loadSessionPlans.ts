import type { SessionId } from '@goodboy/types';
import { listPlansForSession as invokeListPlansForSession } from '../../../features/plans/plans';
import type { SetFn } from './types';

export function loadSessionPlans(set: SetFn) {
  return async (sessionId: SessionId) => {
    const plans = await invokeListPlansForSession(sessionId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [sessionId]: plans },
    }));
  };
}
