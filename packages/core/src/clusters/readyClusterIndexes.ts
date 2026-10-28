import type { ClusterWavePlan } from './planClusterWaves';

type Params = Readonly<{
  plan: ClusterWavePlan;
  doneIndexes: ReadonlySet<number>;
  startedIndexes: ReadonlySet<number>;
}>;

export const readyClusterIndexes = ({
  plan,
  doneIndexes,
  startedIndexes,
}: Params): ReadonlyArray<number> =>
  plan.blockers.flatMap((blockers, index) =>
    !startedIndexes.has(index) && blockers.every((blocker) => doneIndexes.has(blocker))
      ? [index]
      : [],
  );
