import type { AgentId } from '@goodboy/types';
import { kindRouting, type AgentKind } from '../../../features/session/agent-kind';
import { invokeAgentSetKind } from '../../../features/workflows/workflows';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import type { GetFn, SetFn } from './types';

export const setAgentKind = (set: SetFn, get: GetFn) => {
  return (agentId: AgentId, kind: AgentKind) => {
    const state = get();
    const owner = Object.values(state.sessionPhaseRuns ?? {})
      .flat()
      .find((agent) => agent.id === agentId);
    const roleModels = roleModelsForSession({ state, sessionId: owner?.sessionId ?? null });
    set((s) => {
      const nextModelOverride = { ...s.agentModelOverride };
      const nextProviderOverride = { ...s.agentProviderOverride };
      const nextEffortOverride = { ...s.agentEffortOverride };
      const defaults = kindRouting({ kind, roleModels });
      if (defaults?.model) {
        nextModelOverride[agentId] = defaults.model;
        delete nextProviderOverride[agentId];
        delete nextEffortOverride[agentId];
      }
      return {
        agentKindOverride: { ...s.agentKindOverride, [agentId]: kind },
        agentModelOverride: nextModelOverride,
        agentProviderOverride: nextProviderOverride,
        agentEffortOverride: nextEffortOverride,
      };
    });
    void invokeAgentSetKind(agentId, kind).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[store] failed to persist agent kind', err);
      }
    });
  };
};
