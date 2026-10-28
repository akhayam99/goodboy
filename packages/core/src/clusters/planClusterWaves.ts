import type { ImplementationCluster } from '@goodboy/types';
import { clusterTouchesOverlap } from './clusterTouchesOverlap';
import { derivedClusterId } from './derivedClusterId';
import { normalizeTouchPath } from './normalizeTouchPath';
import { sharedPathsOfPair } from './sharedPathsOfPair';

export type ClusterOrderIssue = 'duplicate-id' | 'unknown-id' | 'self-reference' | 'cycle';

export type SharedClusterPath = Readonly<{
  path: string;
  parts: ReadonlyArray<number>;
}>;

export type ClusterWavePlan = Readonly<{
  ids: ReadonlyArray<string>;
  blockers: ReadonlyArray<ReadonlyArray<number>>;
  levels: ReadonlyArray<number>;
  waves: ReadonlyArray<ReadonlyArray<number>>;
  shared: ReadonlyArray<SharedClusterPath>;
  soloIndexes: ReadonlyArray<number>;
  issue: ClusterOrderIssue | null;
}>;

type Params = Readonly<{
  clusters: ReadonlyArray<ImplementationCluster>;
}>;

type IdsResult = Readonly<{
  ids: ReadonlyArray<string>;
  isDuplicate: boolean;
}>;

type DepsParams = Readonly<{
  deps: ReadonlyArray<ReadonlySet<number>>;
}>;

type NodeParams = Readonly<{
  node: number;
}>;

type EdgesResult = Readonly<{
  deps: ReadonlyArray<ReadonlySet<number>>;
  issue: ClusterOrderIssue | null;
}>;

const idsOf = ({ clusters }: Params): IdsResult => {
  const given = clusters.map((cluster, index) => {
    const trimmed = (cluster.id ?? '').trim();
    return trimmed.length > 0 ? trimmed : derivedClusterId({ index });
  });
  if (new Set(given).size === given.length) {
    return { ids: given, isDuplicate: false };
  }
  return { ids: clusters.map((_, index) => derivedClusterId({ index })), isDuplicate: true };
};

const hasCycle = ({ deps }: DepsParams): boolean => {
  const state = deps.map(() => 0);
  const visit = ({ node }: NodeParams): boolean => {
    if (state[node] === 1) {
      return true;
    }
    if (state[node] === 2) {
      return false;
    }
    state[node] = 1;
    for (const next of deps[node] ?? []) {
      if (visit({ node: next })) {
        return true;
      }
    }
    state[node] = 2;
    return false;
  };
  return deps.some((_, node) => visit({ node }));
};

const declaredEdgesOf = ({ clusters, ids, isDuplicate }: Params & IdsResult): EdgesResult => {
  const none = clusters.map(() => new Set<number>());
  const hasAfter = clusters.some((cluster) => (cluster.after ?? []).length > 0);
  if (!hasAfter) {
    return { deps: none, issue: null };
  }
  if (isDuplicate) {
    return { deps: none, issue: 'duplicate-id' };
  }
  const indexById = new Map(ids.map((id, index) => [id, index] as const));
  const deps = clusters.map(() => new Set<number>());
  for (const [index, cluster] of clusters.entries()) {
    for (const reference of cluster.after ?? []) {
      const target = indexById.get(reference.trim());
      if (target === undefined) {
        return { deps: none, issue: 'unknown-id' };
      }
      if (target === index) {
        return { deps: none, issue: 'self-reference' };
      }
      deps[index]!.add(target);
    }
  }
  if (hasCycle({ deps })) {
    return { deps: none, issue: 'cycle' };
  }
  return { deps, issue: null };
};

type WaitsParams = Readonly<{
  deps: ReadonlyArray<ReadonlySet<number>>;
  from: number;
  to: number;
}>;

const waitsOn = ({ deps, from, to }: WaitsParams): boolean => {
  const seen = new Set<number>();
  const stack = [from];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const next of deps[node] ?? []) {
      if (next === to) {
        return true;
      }
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
};

const levelsOf = ({ deps }: DepsParams): ReadonlyArray<number> => {
  const levels: number[] = deps.map(() => -1);
  const levelOf = ({ node }: NodeParams): number => {
    const known = levels[node]!;
    if (known >= 0) {
      return known;
    }
    let level = 0;
    for (const dep of deps[node] ?? []) {
      level = Math.max(level, levelOf({ node: dep }) + 1);
    }
    levels[node] = level;
    return level;
  };
  deps.forEach((_, node) => levelOf({ node }));
  return levels;
};

type ClusterParams = Readonly<{
  cluster: ImplementationCluster;
}>;

const hasTouches = ({ cluster }: ClusterParams): boolean =>
  (cluster.touches ?? []).some((path) => normalizeTouchPath({ path }).length > 0);

type SharedParams = Readonly<{
  clusters: ReadonlyArray<ImplementationCluster>;
  levels: ReadonlyArray<number>;
}>;

const sharedOf = ({ clusters, levels }: SharedParams): ReadonlyArray<SharedClusterPath> => {
  const partsByPath = new Map<string, Set<number>>();
  for (let first = 0; first < clusters.length; first++) {
    for (let second = first + 1; second < clusters.length; second++) {
      const paths = sharedPathsOfPair({
        first: clusters[first]!.touches,
        second: clusters[second]!.touches,
      });
      for (const path of paths) {
        const parts = partsByPath.get(path) ?? new Set<number>();
        parts.add(first);
        parts.add(second);
        partsByPath.set(path, parts);
      }
    }
  }
  return Array.from(partsByPath.entries())
    .map(([path, parts]) => ({
      path,
      parts: Array.from(parts).sort((left, right) => {
        const byLevel = (levels[left] ?? 0) - (levels[right] ?? 0);
        return byLevel === 0 ? left - right : byLevel;
      }),
    }))
    .sort((left, right) => {
      const byFirst = left.parts[0]! - right.parts[0]!;
      return byFirst === 0 ? left.path.localeCompare(right.path) : byFirst;
    });
};

export const planClusterWaves = ({ clusters }: Params): ClusterWavePlan => {
  const { ids, isDuplicate } = idsOf({ clusters });
  const declared = declaredEdgesOf({ clusters, ids, isDuplicate });
  const deps = declared.deps.map((set) => new Set(set));
  for (let first = 0; first < clusters.length; first++) {
    for (let second = first + 1; second < clusters.length; second++) {
      if (
        !clusterTouchesOverlap({
          first: clusters[first]!.touches,
          second: clusters[second]!.touches,
        })
      ) {
        continue;
      }
      if (
        waitsOn({ deps, from: first, to: second }) ||
        waitsOn({ deps, from: second, to: first })
      ) {
        continue;
      }
      deps[second]!.add(first);
    }
  }
  const levels = levelsOf({ deps });
  const depth = levels.reduce((max, level) => Math.max(max, level), -1);
  const waves = Array.from({ length: depth + 1 }, (_, level) =>
    clusters.flatMap((_cluster, index) => (levels[index] === level ? [index] : [])),
  );
  return {
    ids,
    blockers: deps.map((set) => Array.from(set).sort((left, right) => left - right)),
    levels,
    waves,
    shared: sharedOf({ clusters, levels }),
    soloIndexes:
      clusters.length < 2
        ? []
        : clusters.flatMap((cluster, index) => (hasTouches({ cluster }) ? [] : [index])),
    issue: declared.issue,
  };
};
