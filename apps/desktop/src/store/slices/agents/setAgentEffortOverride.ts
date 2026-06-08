import type { AgentId } from '@goodboy/types';
import type { SetFn } from './types';

export function setAgentEffortOverride(set: SetFn) {
  return (agentId: AgentId, effort: string) => {
    set((s) => ({
      agentEffortOverride: { ...s.agentEffortOverride, [agentId]: effort },
    }));
  };
}
