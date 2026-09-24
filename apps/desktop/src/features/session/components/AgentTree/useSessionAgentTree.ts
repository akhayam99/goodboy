import { useMemo } from 'react';
import type { Agent } from '@goodboy/types';

type Params = {
  readonly phaseRuns: ReadonlyArray<Agent>;
};

export const useSessionAgentTree = ({ phaseRuns }: Params) => {
  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);

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

  return {
    adHocAgents,
    agentsByRunId,
    childrenByParentId,
  };
};
