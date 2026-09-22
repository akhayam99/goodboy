import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, ClusterGraphNode, PlanClusterRole, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

export type ClusterNodeView = Readonly<{
  role: PlanClusterRole;
  dependsOnTitles: ReadonlyArray<string>;
  pendingDependencyTitles: ReadonlyArray<string>;
  expectedOutput: string | null;
}>;

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
  return useMemo(() => {
    for (const graph of graphs) {
      const binding = graph.nodes.find((node) => node.agentId === agentId);
      if (binding === undefined) {
        continue;
      }
      const node = graph.graph.nodes.find((entry) => entry.id === binding.nodeId);
      if (node === undefined) {
        continue;
      }
      const pending = node.dependsOn.filter((dependency) => {
        const dependencyAgentId = graph.nodes.find((entry) => entry.nodeId === dependency)?.agentId;
        return dependencyAgentId == null || completedAgentIds.includes(dependencyAgentId) === false;
      });
      return {
        role: node.role,
        dependsOnTitles: titlesFor({ ids: node.dependsOn, nodes: graph.graph.nodes }),
        pendingDependencyTitles: titlesFor({ ids: pending, nodes: graph.graph.nodes }),
        expectedOutput: node.expectedOutput,
      };
    }
    return null;
  }, [graphs, completedAgentIds, agentId]);
};
