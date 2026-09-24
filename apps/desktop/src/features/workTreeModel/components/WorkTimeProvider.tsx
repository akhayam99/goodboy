import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, MeasuredTurnSpan, SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { useNow } from '../../../shared/hooks/useNow';
import { WorkTimeContext, type WorkTimeSource } from '../workTimeSource';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly children: ReactNode;
};

const NO_SPANS: ReadonlyArray<MeasuredTurnSpan> = [];

export const WorkTimeProvider = ({ sessionId, workspaceId, children }: Props) => {
  const spans = useAppStore((state) => state.sessionTurnSpans?.[sessionId]);
  const history = useAppStore((state) => state.workspaceDurationHistory?.[workspaceId]);
  const agents = useAppStore(
    (state) => state.sessionPhaseRuns?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const liveStarts = useAppStore(
    useShallow((state) => {
      const starts: Record<string, string> = {};
      for (const agent of state.sessionPhaseRuns?.[sessionId] ??
        (EMPTY_ARRAY as ReadonlyArray<Agent>)) {
        const turn = state.agentTurnState?.[agent.id];
        if (turn?.kind === 'running') {
          starts[agent.id] = turn.startedAt;
        }
      }
      return starts;
    }),
  );
  const loadSessionTurnSpans = useAppStore((state) => state.loadSessionTurnSpans);
  const loadWorkspaceDurationHistory = useAppStore((state) => state.loadWorkspaceDurationHistory);
  const isSpansLoaded = spans !== undefined;
  const isHistoryLoaded = history !== undefined;

  useEffect(() => {
    if (!isSpansLoaded) {
      void loadSessionTurnSpans?.({ sessionId });
    }
  }, [isSpansLoaded, loadSessionTurnSpans, sessionId]);

  useEffect(() => {
    if (!isHistoryLoaded) {
      void loadWorkspaceDurationHistory?.({ workspaceId });
    }
  }, [isHistoryLoaded, loadWorkspaceDurationHistory, workspaceId]);

  const isLive = Object.keys(liveStarts).length > 0;
  const nowMs = useNow(5_000, isLive);

  const childrenOf = useMemo(() => {
    const children = new Map<string, Array<AgentId>>();
    for (const agent of agents) {
      if (agent.parentAgentId == null) {
        continue;
      }
      const siblings = children.get(agent.parentAgentId);
      if (siblings === undefined) {
        children.set(agent.parentAgentId, [agent.id]);
        continue;
      }
      siblings.push(agent.id);
    }
    return children;
  }, [agents]);

  const liveStartMs = useMemo(() => {
    const starts = new Map<string, number>();
    for (const [agentId, startedAt] of Object.entries(liveStarts)) {
      const parsed = Date.parse(startedAt);
      if (!Number.isNaN(parsed)) {
        starts.set(agentId, parsed);
      }
    }
    return starts;
  }, [liveStarts]);

  const source = useMemo(
    (): WorkTimeSource => ({
      nowMs,
      spans: spans ?? NO_SPANS,
      history: history ?? null,
      liveStartMs,
      childrenOf,
    }),
    [childrenOf, history, liveStartMs, nowMs, spans],
  );

  return <WorkTimeContext.Provider value={source}>{children}</WorkTimeContext.Provider>;
};
