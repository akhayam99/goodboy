import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import {
  agentHomeLens,
  classifyAgent,
  resolveRootAgent,
  type AgentHomeLens,
} from '../../../../agent-kind';

export const useSelectedAgentHome = (sessionId: SessionId): AgentHomeLens | null => {
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const rootAgent = useMemo(() => {
    if (selectedAgentId == null) {
      return null;
    }
    return resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId });
  }, [selectedAgentId, phaseRuns]);
  const override = useAppStore((s) => {
    if (rootAgent == null) {
      return null;
    }
    return s.agentKindOverride[rootAgent.id] ?? null;
  });
  return useMemo(() => {
    if (rootAgent == null) {
      return null;
    }
    return agentHomeLens(rootAgent, classifyAgent(rootAgent, override));
  }, [rootAgent, override]);
};
