import { clusterAncestors } from './clusterAncestors';
import type { ClusterWavePlan } from './planClusterWaves';

type Params = Readonly<{
  plan: ClusterWavePlan;
  index: number;
}>;

export const concurrentClusters = ({ plan, index }: Params): ReadonlyArray<number> => {
  const mine = new Set(clusterAncestors({ plan, index }));
  return plan.blockers.flatMap((_, other) => {
    if (other === index || mine.has(other)) {
      return [];
    }
    return clusterAncestors({ plan, index: other }).includes(index) ? [] : [other];
  });
};
