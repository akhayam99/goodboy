import type { Agent, AgentId, ImplementationCluster } from '@goodboy/types';
import { isAgentStatusSettled } from '@goodboy/core';
import { planClusterWaves, readyClusterIndexes } from '@goodboy/core/clusters';
import { clusterLaunching } from './clusterLaunching';

type Params = Readonly<{
  children: ReadonlyArray<Agent>;
  clusters: ReadonlyArray<ImplementationCluster>;
  justDoneId?: AgentId;
}>;

type ChildParams = Readonly<{
  child: Agent;
}>;

const isChildSettled = ({ child }: ChildParams): boolean =>
  isAgentStatusSettled({ status: child.status });

export const launchableChildren = ({
  children: given,
  clusters,
  justDoneId,
}: Params): ReadonlyArray<Agent> => {
  const children = given.map((child) =>
    child.id === justDoneId ? { ...child, status: 'completed' as const } : child,
  );
  clusterLaunching.prune({ children });
  if (clusters.length !== children.length) {
    const first = children.find((child) => !isChildSettled({ child }));
    if (first === undefined || first.status !== 'pending') {
      return [];
    }
    return clusterLaunching.has({ childId: first.id }) ? [] : [given[children.indexOf(first)]!];
  }
  const doneIndexes = new Set<number>();
  const startedIndexes = new Set<number>();
  children.forEach((child, index) => {
    if (isChildSettled({ child })) {
      doneIndexes.add(index);
    }
    if (child.status !== 'pending' || clusterLaunching.has({ childId: child.id })) {
      startedIndexes.add(index);
    }
  });
  return readyClusterIndexes({
    plan: planClusterWaves({ clusters }),
    doneIndexes,
    startedIndexes,
  }).map((index) => given[index]!);
};
