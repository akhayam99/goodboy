import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionLoading } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { classifyAgent, isStandaloneAgent, type AgentKind } from '../../agent-kind';
import { isAgentFinished } from '../../agent-lifecycle';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';

type Params = {
  readonly session: Session;
};

export const useStandaloneAgentsLane = ({ session }: Params) => {
  const sessionId = session.id as SessionId;
  const isTaskActive = useAppStore((state) => state.currentSessionId === sessionId);
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const messages = useAppStore((state) => state.messages[sessionId] ?? EMPTY_ARRAY);
  const agentKindOverride = useAppStore(
    useShallow((state) => {
      const out: Record<string, AgentKind> = {};
      const runs = state.sessionPhaseRuns[sessionId];
      if (runs == null) {
        return out;
      }
      for (const run of runs) {
        const kind = state.agentKindOverride[run.id];
        if (kind == null) {
          continue;
        }
        out[run.id] = kind;
      }
      return out;
    }),
  );
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const renameAgent = useAppStore((state) => state.renameAgent);
  const deleteAgent = useAppStore((state) => state.deleteAgent);
  const setAgentDone = useAppStore((state) => state.setAgentDone);
  const clearAgentDone = useAppStore((state) => state.clearAgentDone);
  const loading = useSessionLoading(sessionId);
  const metrics = useAgentMetrics({ sessionId });

  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<AgentId | null>(null);
  const [clusterExpand, setClusterExpand] = useState<ReadonlyMap<string, boolean>>(new Map());

  const toggleClusterExpand = useCallback((id: string) => {
    setClusterExpand((previous) => {
      const next = new Map(previous);
      next.set(id, !(previous.get(id) ?? false));
      return next;
    });
  }, []);

  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const run of sorted) {
      if (run.parentAgentId == null) {
        continue;
      }
      const bucket = map.get(run.parentAgentId) ?? [];
      bucket.push(run);
      map.set(run.parentAgentId, bucket);
    }
    return map;
  }, [sorted]);

  useEffect(() => {
    if (selectedAgentId == null) {
      return;
    }
    const agentsById = new Map(sorted.map((agent) => [agent.id, agent]));
    const ancestorIds: AgentId[] = [];
    const visited = new Set<AgentId>([selectedAgentId]);
    let agent = agentsById.get(selectedAgentId) ?? null;

    while (agent?.parentAgentId != null) {
      const parent = agentsById.get(agent.parentAgentId) ?? null;
      if (parent == null || visited.has(parent.id)) {
        break;
      }
      ancestorIds.push(parent.id);
      visited.add(parent.id);
      agent = parent;
    }
    if (ancestorIds.length === 0) {
      return;
    }
    setClusterExpand((previous) => {
      if (ancestorIds.every((id) => previous.get(id) === true)) {
        return previous;
      }
      const next = new Map(previous);
      for (const id of ancestorIds) {
        next.set(id, true);
      }
      return next;
    });
  }, [selectedAgentId, sorted]);

  const firstUserTextByAgentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const message of messages) {
      if (message.role !== 'user') {
        continue;
      }
      if (map.has(message.agentId)) {
        continue;
      }
      map.set(message.agentId, message.content);
    }
    return map;
  }, [messages]);

  const standaloneAgents = useMemo(
    () =>
      sorted
        .filter(
          (run) =>
            isStandaloneAgent(run) &&
            classifyAgent(run, agentKindOverride[run.id] ?? null) !== 'resolver',
        )
        .sort((a, b) => b.ordinal - a.ordinal),
    [sorted, agentKindOverride],
  );
  const activeAgents = useMemo(
    () => standaloneAgents.filter((agent) => !isAgentFinished({ agent })),
    [standaloneAgents],
  );
  const completedAgents = useMemo(
    () => standaloneAgents.filter((agent) => isAgentFinished({ agent })),
    [standaloneAgents],
  );

  const onPickAgent = useCallback(
    (agentId: AgentId) => {
      if (agentId !== selectedAgentId) {
        void selectAgent(sessionId, agentId);
      }
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    },
    [selectAgent, selectedAgentId, sessionId],
  );

  const onRenameCommit = useCallback(
    async (agentId: AgentId, name: string) => {
      setEditingId(null);
      try {
        await renameAgent(sessionId, agentId, name);
      } catch (err) {
        setError(formatError(err));
      }
    },
    [renameAgent, sessionId],
  );

  const onDeleteAgent = useCallback(
    async (agentId: AgentId) => {
      try {
        await deleteAgent(sessionId, agentId);
      } catch (err) {
        setError(formatError(err));
      }
    },
    [deleteAgent, sessionId],
  );

  const onMarkDone = useCallback(
    (agentId: AgentId) => {
      void setAgentDone(sessionId, agentId);
    },
    [setAgentDone, sessionId],
  );

  const onReopen = useCallback(
    (agentId: AgentId) => {
      void clearAgentDone(sessionId, agentId);
    },
    [clearAgentDone, sessionId],
  );

  return {
    activeAgents,
    agentKindOverride,
    childrenByParentId,
    clusterExpand,
    completedAgents,
    editingId,
    error,
    firstUserTextByAgentId,
    isAgentsLoading: loading.agents,
    isTaskActive,
    isTranscriptLoading: loading.transcript,
    metrics,
    onDeleteAgent,
    onMarkDone,
    onReopen,
    onPickAgent,
    onRenameCommit,
    selectedAgentId,
    setEditingId,
    standaloneAgents,
    toggleClusterExpand,
  };
};
