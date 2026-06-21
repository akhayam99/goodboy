import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { agentHomeLens, resolveAgentKind, type AgentHomeLens } from '../../../../agent-kind';

export const useSelectedAgentHome = (sessionId: SessionId): AgentHomeLens | null => {
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const messages = useAppStore((s) => s.messages[sessionId] ?? EMPTY_ARRAY);
  const override = useAppStore((s) =>
    selectedAgentId ? (s.agentKindOverride[selectedAgentId] ?? null) : null,
  );
  return useMemo(() => {
    if (!selectedAgentId) {
      return null;
    }
    const agent = phaseRuns.find((r) => r.id === selectedAgentId);
    if (!agent) {
      return null;
    }
    const firstUserText =
      messages.find((m) => m.role === 'user' && m.agentId === selectedAgentId)?.content ?? null;
    const kind = resolveAgentKind(agent.name, firstUserText, override);
    return agentHomeLens(agent, kind);
  }, [selectedAgentId, phaseRuns, messages, override]);
};
