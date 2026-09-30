import type { AgentId, SessionId } from '@goodboy/types';
import type { AgentKindRouting } from '../../../features/session/agent-kind';
import { composeHandoffSeed } from '../../../features/chat/utils/composeHandoffSeed';
import { handoffSourceOutput } from './handoffSourceOutput';
import { recordOutcome } from './recordOutcome';
import type { GetFn, SetFn } from './types';

export type HandoffAcceptParams = {
  readonly sessionId: SessionId;
  readonly routing?: AgentKindRouting;
  readonly seedPrompt?: string;
};

export const acceptSessionNudgeHandoff = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    routing: pickedRouting,
    seedPrompt: pickedSeed,
  }: HandoffAcceptParams): Promise<AgentId | null> => {
    const nudge = get().sessionNudges[sessionId] ?? null;
    if (!nudge) {
      return null;
    }
    set((state) => ({
      sessionNudges: { ...state.sessionNudges, [sessionId]: null },
    }));
    await recordOutcome(nudge.id, 'accepted');
    const routing =
      pickedRouting === undefined
        ? {}
        : {
            provider: pickedRouting.provider,
            model: pickedRouting.model,
            effort: pickedRouting.effort,
          };
    if (nudge.kind === 'plan-ready') {
      if (nudge.planId !== null) {
        return await get().spawnAgent(sessionId, {
          triggeredPlanId: nudge.planId,
          kindOverride: 'implementer',
          parentAgentId: nudge.agentId,
          focus: 'none',
          ...routing,
        });
      }
      return await get().spawnAgent(sessionId, {
        kindOverride: 'implementer',
        parentAgentId: nudge.agentId,
        focus: 'none',
        ...routing,
      });
    }
    if (nudge.kind === 'handoff-suggested') {
      const source = handoffSourceOutput({ state: get(), sessionId, agentId: nudge.agentId });
      const seedPrompt =
        pickedSeed ??
        composeHandoffSeed({
          sourceName: source.name,
          reason: nudge.reason,
          output: source.output,
        });
      return await get().spawnAgent(sessionId, {
        kindOverride: nudge.targetKind,
        ...(nudge.planId !== null && { triggeredPlanId: nudge.planId }),
        parentAgentId: nudge.agentId,
        focus: 'none',
        seedPrompt,
        ...routing,
      });
    }
    return null;
  };
};
