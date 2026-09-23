import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  AgentId,
  ClusterCompletionHold,
  ClusterGraphNode,
  ClusterNodeResultState,
  ClusterNodeState,
  PlanClusterRole,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../store';
import { completedSourceIds } from '../../store/slices/workflows/clusterSourceProgress';

export type ClusterNodeView = Readonly<{
  role: PlanClusterRole;
  dependsOnTitles: ReadonlyArray<string>;
  pendingDependencyTitles: ReadonlyArray<string>;
  expectedOutput: string | null;
  state: ClusterNodeState;
  resultState: ClusterNodeResultState;
  supersededBy: string | null;
  isFrozen: boolean;
}>;

const NO_HOLDS: ReadonlyArray<ClusterCompletionHold> = [];

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const titlesFor = ({
  ids,
  nodes,
}: {
  readonly ids: ReadonlyArray<string>;
  readonly nodes: ReadonlyArray<ClusterGraphNode>;
}): ReadonlyArray<string> =>
  ids.flatMap((id) => {
    const match = nodes.find((node) => node.id === id);
    return match === undefined ? [] : [match.title];
  });

export const useClusterNode = ({ sessionId, agentId }: Params): ClusterNodeView | null => {
  const graphs = useAppStore(
    useShallow((state) => state.clusterExecutionGraphs?.[sessionId] ?? []),
  );
  const completedAgentIds = useAppStore(
    useShallow((state) =>
      (state.sessionPhaseRuns?.[sessionId] ?? [])
        .filter((agent) => agent.status === 'completed')
        .map((agent) => agent.id),
    ),
  );
  const holds = useAppStore((state) => state.clusterCompletionHolds?.[sessionId] ?? NO_HOLDS);
  return useMemo(() => {
    for (const graph of graphs) {
      const binding = graph.nodes.find((node) => node.agentId === agentId);
      if (binding === undefined) {
        continue;
      }
      const isFrozen = graph.frozenReason !== null;
      const node = graph.graph.nodes.find((entry) => entry.id === binding.nodeId);
      if (node === undefined) {
        return {
          role: binding.role,
          dependsOnTitles: [],
          pendingDependencyTitles: [],
          expectedOutput: null,
          state: binding.state,
          resultState: binding.resultState,
          supersededBy: binding.supersededBy,
          isFrozen,
        };
      }
      const completedThroughHold = completedSourceIds({
        holds,
        containerId: graph.containerAgentId,
        resolvingHoldId: null,
      });
      const pending = node.dependsOn.filter((dependency) => {
        const dependencyAgentId = graph.nodes.find((entry) => entry.nodeId === dependency)?.agentId;
        return (
          dependencyAgentId == null ||
          (completedAgentIds.includes(dependencyAgentId) === false &&
            completedThroughHold.has(dependencyAgentId) === false)
        );
      });
      return {
        role: node.role,
        dependsOnTitles: titlesFor({ ids: node.dependsOn, nodes: graph.graph.nodes }),
        pendingDependencyTitles: titlesFor({ ids: pending, nodes: graph.graph.nodes }),
        expectedOutput: node.expectedOutput,
        state: binding.state,
        resultState: binding.resultState,
        supersededBy: binding.supersededBy,
        isFrozen,
      };
    }
    return null;
  }, [graphs, completedAgentIds, holds, agentId]);
};
