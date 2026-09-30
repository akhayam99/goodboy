import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, SessionId } from '@goodboy/types';
import {
  selectNonResolverStandaloneAgents,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { useAppStore } from '../../store';
import { agentHasUnread } from './agentHasUnread';

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];

export const useSessionLastTurnFinishedAt = (sessionId: SessionId | null): string | null =>
  useAppStore((s) => {
    if (sessionId == null) {
      return null;
    }
    const runs = s.sessionPhaseRuns[sessionId];
    if (!runs) {
      return null;
    }
    let max: string | null = null;
    for (const run of runs) {
      const t = run.lastFinishedAt ?? null;
      if (t && (max === null || t > max)) {
        max = t;
      }
    }
    return max;
  });

const useSessionAgentKindOverrides = (sessionId: SessionId): Readonly<Record<string, AgentKind>> =>
  useAppStore(
    useShallow((state) => {
      const overrides: Record<string, AgentKind> = {};
      for (const agent of state.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS) {
        const override = state.agentKindOverride[agent.id];
        if (override != null) {
          overrides[agent.id] = override;
        }
      }
      return overrides;
    }),
  );

export const useNonResolverStandaloneAgents = (sessionId: SessionId): ReadonlyArray<Agent> => {
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  const agentKindOverride = useSessionAgentKindOverrides(sessionId);
  return useMemo(
    () => selectNonResolverStandaloneAgents({ agents: phaseRuns, agentKindOverride }),
    [phaseRuns, agentKindOverride],
  );
};

export const useSessionHasUnread = (sessionId: SessionId | null): boolean => {
  const phaseRuns = useAppStore((s) =>
    sessionId ? (s.sessionPhaseRuns[sessionId] ?? null) : null,
  );
  const selectedAgentId = useAppStore((s) =>
    sessionId ? (s.selectedAgentId[sessionId] ?? null) : null,
  );
  const isCurrentSession = useAppStore(
    (s) => sessionId !== null && s.currentSessionId === sessionId,
  );
  return useMemo(() => {
    if (!phaseRuns) {
      return false;
    }
    return phaseRuns.some((r) => agentHasUnread(r, isCurrentSession && r.id === selectedAgentId));
  }, [phaseRuns, selectedAgentId, isCurrentSession]);
};
