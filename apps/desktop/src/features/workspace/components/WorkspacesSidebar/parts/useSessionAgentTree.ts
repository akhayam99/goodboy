import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Agent, AgentId } from '@goodboy/types';
import { EMPTY_ARRAY, agentHasUnread } from '../../../../../store';

type Params = {
  readonly phaseRuns: ReadonlyArray<Agent>;
  readonly selectedAgentId: AgentId | null;
  readonly isTaskActive: boolean;
};

export const useSessionAgentTree = ({ phaseRuns, selectedAgentId, isTaskActive }: Params) => {
  const [clusterExpand, setClusterExpand] = useState<ReadonlyMap<string, boolean>>(new Map());

  const toggleClusterExpand = useCallback((id: string) => {
    setClusterExpand((prev) => {
      const next = new Map(prev);
      next.set(id, !(prev.get(id) ?? false));
      return next;
    });
  }, []);

  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);

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

  const agentsByRunId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const r of sorted) {
      if (r.parentAgentId != null || r.stepId == null || r.workflowRunId == null) {
        continue;
      }
      const bucket = map.get(r.workflowRunId) ?? [];
      bucket.push(r);
      map.set(r.workflowRunId, bucket);
    }
    return map;
  }, [sorted]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const r of sorted) {
      if (r.parentAgentId == null) {
        continue;
      }
      const bucket = map.get(r.parentAgentId) ?? [];
      bucket.push(r);
      map.set(r.parentAgentId, bucket);
    }
    return map;
  }, [sorted]);

  const adHocAgents = useMemo(
    () =>
      sorted.filter(
        (r) => r.parentAgentId == null && !(r.workflowRunId != null && r.stepId != null),
      ),
    [sorted],
  );

  const countUnread = useCallback(
    (agentsList: ReadonlyArray<Agent>): number => {
      let n = 0;
      const visit = (a: Agent) => {
        if (agentHasUnread(a, a.id === selectedAgentId && isTaskActive)) {
          n += 1;
        }
        for (const c of childrenByParentId.get(a.id) ?? EMPTY_ARRAY) {
          visit(c);
        }
      };
      for (const a of agentsList) {
        visit(a);
      }
      return n;
    },
    [childrenByParentId, selectedAgentId, isTaskActive],
  );

  return {
    adHocAgents,
    agentsByRunId,
    childrenByParentId,
    clusterExpand,
    countUnread,
    toggleClusterExpand,
  };
};
