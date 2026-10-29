import type { ClusterWavePlan } from './planClusterWaves';

type Params = Readonly<{
  plan: ClusterWavePlan;
  index: number;
}>;

export const clusterAncestors = ({ plan, index }: Params): ReadonlyArray<number> => {
  const seen = new Set<number>();
  const stack = [index];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const blocker of plan.blockers[node] ?? []) {
      if (!seen.has(blocker)) {
        seen.add(blocker);
        stack.push(blocker);
      }
    }
  }
  return Array.from(seen).sort((left, right) => left - right);
};
