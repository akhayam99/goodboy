import type { SessionId } from '@goodboy/types';
import { recordOutcome } from './recordOutcome';
import type { GetFn, SetFn } from './types';

export const acceptSessionNudgeHandoff = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const nudge = get().sessionNudges[sessionId] ?? null;
    if (!nudge) {
      return;
    }
    set((state) => ({
      sessionNudges: { ...state.sessionNudges, [sessionId]: null },
    }));
    await recordOutcome(nudge.id, 'accepted');
    if (nudge.kind === 'plan-ready') {
      if (nudge.planId !== null) {
        await get().spawnAgent(sessionId, {
          triggeredPlanId: nudge.planId,
          kindOverride: 'implementer',
        });
      } else {
        await get().spawnAgent(sessionId, { kindOverride: 'implementer' });
      }
    } else if (nudge.kind === 'handoff-suggested') {
      await get().spawnAgent(sessionId, {
        kindOverride: nudge.targetKind,
        ...(nudge.planId !== null && { triggeredPlanId: nudge.planId }),
      });
    }
  };
};
