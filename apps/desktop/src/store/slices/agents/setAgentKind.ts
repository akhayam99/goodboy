import type { AgentId } from '@goodboy/types';
import { AGENT_KIND_DEFAULTS, type AgentKind } from '../../../features/session/agent-kind';
import { invokeAgentSetKind } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export function setAgentKind(set: SetFn) {
  return (agentId: AgentId, kind: AgentKind) => {
    set((s) => {
      const nextModelOverride = { ...s.agentModelOverride };
      const defaults = AGENT_KIND_DEFAULTS[kind];
      if (defaults?.model) {
        nextModelOverride[agentId] = defaults.model;
      }
      return {
        agentKindOverride: { ...s.agentKindOverride, [agentId]: kind },
        agentModelOverride: nextModelOverride,
      };
    });
    void invokeAgentSetKind(agentId, kind).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[store] failed to persist agent kind', err);
    });
  };
}
