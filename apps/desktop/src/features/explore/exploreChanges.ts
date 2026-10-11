import type { ChangedEntry } from '../worktree/worktree';
import type { ExploreEntry } from './explore';
import { ancestorPathsOf, EXPLORE_ROOT_PATH, type ExploreListing } from './exploreRows';

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

type ListingParams = {
  readonly changes: ExploreChanges;
  readonly listing: ExploreListing;
};

const parentOf = (relPath: string): string => {
  const slash = relPath.lastIndexOf('/');
  return slash < 0 ? EXPLORE_ROOT_PATH : relPath.slice(0, slash);
};

const nameOf = (relPath: string): string => relPath.slice(relPath.lastIndexOf('/') + 1);

const byKindThenName = (a: ExploreEntry, b: ExploreEntry): number => {
  if (a.isDir !== b.isDir) {
    return a.isDir ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
};

export const changedListingOf = ({ changes, listing }: ListingParams): ExploreListing => {
  const known = new Map<string, ExploreEntry>();
  for (const children of Object.values(listing.entriesByPath)) {
    for (const entry of children) {
      known.set(entry.relPath, entry);
    }
  }
  const childrenByPath = new Map<string, Map<string, ExploreEntry>>();
  const add = (relPath: string, isDir: boolean): void => {
    const parent = parentOf(relPath);
    const siblings = childrenByPath.get(parent) ?? new Map<string, ExploreEntry>();
    childrenByPath.set(parent, siblings);
    if (siblings.has(relPath)) {
      return;
    }
    siblings.set(
      relPath,
      known.get(relPath) ?? {
        name: nameOf(relPath),
        relPath,
        isDir,
        sizeBytes: 0,
        modifiedAt: null,
      },
    );
  };
  for (const path of changes.byPath.keys()) {
    for (const folder of ancestorPathsOf({ relPath: path })) {
      add(folder, true);
    }
    add(path, false);
  }
  const entriesByPath: Record<string, ReadonlyArray<ExploreEntry>> = {};
  for (const [parent, siblings] of childrenByPath) {
    entriesByPath[parent] = [...siblings.values()].sort(byKindThenName);
  }
  return { entriesByPath, loadingByPath: {}, errorByPath: {} };
};

type ExpandedParams = {
  readonly listing: ExploreListing;
  readonly collapsed: Readonly<Record<string, boolean>>;
};

export const changedExpandedOf = ({
  listing,
  collapsed,
}: ExpandedParams): Readonly<Record<string, boolean>> => {
  const expanded: Record<string, boolean> = {};
  for (const children of Object.values(listing.entriesByPath)) {
    for (const entry of children) {
      if (entry.isDir) {
        expanded[entry.relPath] = collapsed[entry.relPath] !== true;
      }
    }
  }
  return expanded;
};
