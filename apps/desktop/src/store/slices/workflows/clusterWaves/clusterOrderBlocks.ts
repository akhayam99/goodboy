import type { ImplementationCluster } from '@goodboy/types';
import { clusterAncestors, concurrentClusters, planClusterWaves } from '@goodboy/core/clusters';

type Params = Readonly<{
  clusters: ReadonlyArray<ImplementationCluster>;
  index: number;
}>;

type Blocks = Readonly<{
  priorBlock: string;
  parallelBlock: string;
}>;

type ListParams = Readonly<{
  clusters: ReadonlyArray<ImplementationCluster>;
  indexes: ReadonlyArray<number>;
}>;

const titlesOf = ({ clusters, indexes }: ListParams): string =>
  indexes.map((index) => `${index + 1}. ${clusters[index]?.title ?? ''}`).join(', ');

export const clusterOrderBlocks = ({ clusters, index }: Params): Blocks => {
  const plan = planClusterWaves({ clusters });
  const prior = clusterAncestors({ plan, index });
  const parallel = concurrentClusters({ plan, index });
  return {
    priorBlock:
      prior.length > 0
        ? `**Done before you** ${titlesOf({ clusters, indexes: prior })} (changes already on disk)`
        : '',
    parallelBlock:
      parallel.length > 0
        ? `**Running at the same time** ${titlesOf({ clusters, indexes: parallel })} (other implementers in this worktree, on other files: stay inside your Touches and leave their files alone)`
        : '',
  };
};
