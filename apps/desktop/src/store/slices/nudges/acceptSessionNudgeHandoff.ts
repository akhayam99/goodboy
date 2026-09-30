import type { AgentId, SessionId } from '@goodboy/types';
import type { AgentKindRouting } from '../../../features/session/agent-kind';
import { composeHandoffSeed } from '../../../features/chat/utils/composeHandoffSeed';
import { handoffSourceOutput } from './handoffSourceOutput';
import { recordOutcome } from './recordOutcome';
import type { GetFn, SetFn } from './types';

export type HandoffAcceptOptions = {
  readonly routing?: AgentKindRouting;
  readonly seedPrompt?: string;
};

export const acceptSessionNudgeHandoff = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    options: HandoffAcceptOptions = {},
  ): Promise<AgentId | null> => {
    const nudge = get().sessionNudges[sessionId] ?? null;
    if (!nudge) {
      return null;
    }
    set((state) => ({
      sessionNudges: { ...state.sessionNudges, [sessionId]: null },
    }));
    await recordOutcome(nudge.id, 'accepted');
    const routing =
      options.routing === undefined
        ? {}
        : {
            provider: options.routing.provider,
            model: options.routing.model,
            effort: options.routing.effort,
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
        options.seedPrompt ??
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
