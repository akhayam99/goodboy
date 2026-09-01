import type { AgentId, SessionId } from '@goodboy/types';
import { recordOutcome } from './recordOutcome';
import type { GetFn, SetFn } from './types';

export const acceptSessionNudgeHandoff = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<AgentId | null> => {
    const nudge = get().sessionNudges[sessionId] ?? null;
    if (!nudge) {
      return null;
    }
    set((state) => ({
      sessionNudges: { ...state.sessionNudges, [sessionId]: null },
    }));
    await recordOutcome(nudge.id, 'accepted');
    if (nudge.kind === 'plan-ready') {
      if (nudge.planId !== null) {
        return await get().spawnAgent(sessionId, {
          triggeredPlanId: nudge.planId,
          kindOverride: 'implementer',
          parentAgentId: nudge.agentId,
          focus: 'none',
        });
      }
      return await get().spawnAgent(sessionId, {
        kindOverride: 'implementer',
        parentAgentId: nudge.agentId,
        focus: 'none',
      });
    }
    if (nudge.kind === 'handoff-suggested') {
      return await get().spawnAgent(sessionId, {
        kindOverride: nudge.targetKind,
        ...(nudge.planId !== null && { triggeredPlanId: nudge.planId }),
        parentAgentId: nudge.agentId,
        focus: 'none',
      });
    }
    return null;
  };
};
