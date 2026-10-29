import type { Agent, AgentId, ImplementationCluster } from '@goodboy/types';
import { clusterAncestors, clusterTouchesOverlap, planClusterWaves } from '@goodboy/core/clusters';

type Params = Readonly<{
  children: ReadonlyArray<Agent>;
  clusters: ReadonlyArray<ImplementationCluster>;
  childId: AgentId;
}>;

export const overlappingRunningParts = ({
  children,
  clusters,
  childId,
}: Params): ReadonlyArray<Agent> => {
  const index = children.findIndex((child) => child.id === childId);
  if (index < 0 || children.length !== clusters.length) {
    return [];
  }
  const ancestors = new Set(clusterAncestors({ plan: planClusterWaves({ clusters }), index }));
  return children.filter(
    (other, otherIndex) =>
      otherIndex !== index &&
      other.status === 'running' &&
      (ancestors.has(otherIndex) ||
        clusterTouchesOverlap({
          first: clusters[index]!.touches,
          second: clusters[otherIndex]!.touches,
        })),
  );
};
