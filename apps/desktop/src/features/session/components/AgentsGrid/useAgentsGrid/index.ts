import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionLoading, agentPlace } from '../../../../../store';
import { classifyAgent, isStandaloneAgent, type AgentKind } from '../../../agent-kind';
import { isAgentFinished } from '../../../agent-lifecycle';
import { useAgentLifecycleSignals } from '../../../hooks/useAgentLifecycleSignals';
import { openAgentRevealEvent } from '../../../../../shared/utils/openAgentReveal';

type Params = {
  readonly session: Session;
};

export const useAgentsGrid = ({ session }: Params) => {
  const sessionId = session.id;
  const phaseRuns: ReadonlyArray<Agent> = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY,
  );
  const agentKindOverride = useAppStore(
    useShallow((state) => {
      const out: Record<string, AgentKind> = {};
      for (const run of state.sessionPhaseRuns[sessionId] ?? []) {
        const kind = state.agentKindOverride[run.id];
        if (kind === undefined) {
          continue;
        }
        out[run.id] = kind;
      }
      return out;
    }),
  );
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const navigate = useAppStore((state) => state.navigate);
  const loading = useSessionLoading(sessionId);
  const signals = useAgentLifecycleSignals({ sessionId });

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const run of phaseRuns) {
      if (run.parentAgentId == null) {
        continue;
      }
      const bucket = map.get(run.parentAgentId) ?? [];
      bucket.push(run);
      map.set(run.parentAgentId, bucket);
    }
    return map;
  }, [phaseRuns]);

  const standaloneAgents = useMemo(
    () =>
      [...phaseRuns]
        .filter(
          (run) =>
            isStandaloneAgent({ agent: run }) &&
            classifyAgent({ agent: run, override: agentKindOverride[run.id] ?? null }) !==
              'resolver',
        )
        .sort((a, b) => b.ordinal - a.ordinal),
    [phaseRuns, agentKindOverride],
  );
  const finishedIds = useMemo(
    () =>
      new Set(
        standaloneAgents
          .filter((agent) =>
            isAgentFinished({
              agent,
              hasOpenQuestion: signals.openQuestionAgentIds.has(agent.id),
              isTurnLive: signals.liveTurnAgentIds.has(agent.id),
              hasActiveChild: (childrenByParentId.get(agent.id) ?? []).some(
                (child) => child.status === 'pending' || child.status === 'running',
              ),
            }),
          )
          .map((agent) => agent.id),
      ),
    [standaloneAgents, signals, childrenByParentId],
  );
  const activeAgents = useMemo(
    () => standaloneAgents.filter((agent) => !finishedIds.has(agent.id)),
    [standaloneAgents, finishedIds],
  );
  const completedAgents = useMemo(
    () => standaloneAgents.filter((agent) => finishedIds.has(agent.id)),
    [standaloneAgents, finishedIds],
  );

  const onPickAgent = useCallback(
    (agentId: AgentId) => {
      if (agentId !== selectedAgentId) {
        navigate({ to: agentPlace({ sessionId, agentId }) });
      }
      window.dispatchEvent(openAgentRevealEvent());
    },
    [navigate, selectedAgentId, sessionId],
  );

  return {
    activeAgents,
    agentKindOverride,
    completedAgents,
    isAgentsLoading: loading.agents,
    onPickAgent,
    standaloneAgents,
  };
};
