import type { ChangedEntry } from '../worktree/worktree';
import { ancestorPathsOf } from './exploreRows';

export type ExploreChanges = {
  readonly byPath: ReadonlyMap<string, ChangedEntry>;
  readonly countByFolder: ReadonlyMap<string, number>;
  readonly count: number;
};

export const NO_EXPLORE_CHANGES: ExploreChanges = {
  byPath: new Map(),
  countByFolder: new Map(),
  count: 0,
};

type BuildParams = {
  readonly entries: ReadonlyArray<ChangedEntry>;
};

export const buildExploreChanges = ({ entries }: BuildParams): ExploreChanges => {
  const byPath = new Map<string, ChangedEntry>();
  const countByFolder = new Map<string, number>();
  for (const entry of entries) {
    if (byPath.has(entry.path)) {
      continue;
    }
    byPath.set(entry.path, entry);
    for (const folder of ancestorPathsOf({ relPath: entry.path })) {
      countByFolder.set(folder, (countByFolder.get(folder) ?? 0) + 1);
    }
  }
  return { byPath, countByFolder, count: byPath.size };
};
