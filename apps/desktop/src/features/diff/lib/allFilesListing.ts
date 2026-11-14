import type { FileDiff } from '@goodboy/types';
import type { ExploreEntry } from '../../explore/explore';
import {
  ancestorPathsOf,
  EXPLORE_ROOT_PATH,
  type ExploreEntryRow,
  type ExploreListing,
} from '../../explore/exploreRows';

export const ALL_FILES_ROW_PX = 28;

type MergeParams = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly listing: ExploreListing;
};

type PathParams = {
  readonly relPath: string;
};

type NewEntryParams = PathParams & {
  readonly isDir: boolean;
};

type FilesParams = {
  readonly files: ReadonlyArray<FileDiff>;
};

const parentFolderOf = ({ relPath }: PathParams): string => {
  const slash = relPath.lastIndexOf('/');
  return slash < 0 ? EXPLORE_ROOT_PATH : relPath.slice(0, slash);
};

const baseNameOf = ({ relPath }: PathParams): string => relPath.slice(relPath.lastIndexOf('/') + 1);

type SortParams = {
  readonly entries: Iterable<ExploreEntry>;
};

const sortedEntries = ({ entries }: SortParams): ReadonlyArray<ExploreEntry> =>
  [...entries].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));

const diffEntryOf = ({ relPath, isDir }: NewEntryParams): ExploreEntry => ({
  name: baseNameOf({ relPath }),
  relPath,
  isDir,
  sizeBytes: null,
  modifiedAt: null,
});

export const allFilesListingOf = ({ files, listing }: MergeParams): ExploreListing => {
  const changedChildren = new Map<string, Map<string, ExploreEntry>>();
  const addChanged = ({ relPath, isDir }: NewEntryParams): void => {
    const parent = parentFolderOf({ relPath });
    const siblings = changedChildren.get(parent) ?? new Map<string, ExploreEntry>();
    changedChildren.set(parent, siblings);
    if (!siblings.has(relPath)) {
      siblings.set(relPath, diffEntryOf({ relPath, isDir }));
    }
  };
  for (const file of files) {
    for (const folder of ancestorPathsOf({ relPath: file.path })) {
      addChanged({ relPath: folder, isDir: true });
    }
    addChanged({ relPath: file.path, isDir: false });
  }

  const onDisk = new Set<string>();
  for (const children of Object.values(listing.entriesByPath)) {
    for (const entry of children) {
      onDisk.add(entry.relPath);
    }
  }

  const entriesByPath: Record<string, ReadonlyArray<ExploreEntry>> = {};
  for (const [parent, loaded] of Object.entries(listing.entriesByPath)) {
    const merged = new Map<string, ExploreEntry>(loaded.map((entry) => [entry.relPath, entry]));
    for (const [relPath, entry] of changedChildren.get(parent) ?? []) {
      if (!merged.has(relPath)) {
        merged.set(relPath, entry);
      }
    }
    entriesByPath[parent] = sortedEntries({ entries: merged.values() });
  }
  for (const [parent, siblings] of changedChildren) {
    const isParentLoaded = listing.entriesByPath[parent] !== undefined;
    const isParentOnDisk = parent === EXPLORE_ROOT_PATH || onDisk.has(parent);
    if (isParentLoaded || isParentOnDisk) {
      continue;
    }
    entriesByPath[parent] = sortedEntries({ entries: siblings.values() });
  }

  return {
    entriesByPath,
    loadingByPath: listing.loadingByPath,
    errorByPath: listing.errorByPath,
  };
};

type FolderSum = {
  readonly additions: number;
  readonly deletions: number;
  readonly count: number;
};

export const folderSumsOf = ({ files }: FilesParams): ReadonlyMap<string, FolderSum> => {
  const sums = new Map<string, FolderSum>();
  for (const file of files) {
    for (const folder of ancestorPathsOf({ relPath: file.path })) {
      const before = sums.get(folder) ?? { additions: 0, deletions: 0, count: 0 };
      sums.set(folder, {
        additions: before.additions + file.additions,
        deletions: before.deletions + file.deletions,
        count: before.count + 1,
      });
    }
  }
  return sums;
};

type MatchParams = {
  readonly listing: ExploreListing;
  readonly query: string;
};

export const matchingFilesOf = ({ listing, query }: MatchParams): ReadonlyArray<ExploreEntry> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [];
  }
  const found = new Map<string, ExploreEntry>();
  for (const children of Object.values(listing.entriesByPath)) {
    for (const entry of children) {
      if (!entry.isDir && entry.relPath.toLowerCase().includes(needle)) {
        found.set(entry.relPath, entry);
      }
    }
  }
  return [...found.values()].sort((a, b) => a.relPath.localeCompare(b.relPath));
};

type SearchParams = MatchParams & FilesParams;

export const searchRowsOf = ({
  files,
  listing,
  query,
}: SearchParams): ReadonlyArray<ExploreEntryRow> => {
  const matches = new Map<string, ExploreEntry>(
    matchingFilesOf({ listing, query }).map((entry) => [entry.relPath, entry]),
  );
  const needle = query.trim().toLowerCase();
  for (const file of files) {
    if (!matches.has(file.path) && file.path.toLowerCase().includes(needle)) {
      matches.set(file.path, diffEntryOf({ relPath: file.path, isDir: false }));
    }
  }
  return [...matches.values()]
    .sort((a, b) => a.relPath.localeCompare(b.relPath))
    .map((entry) => ({
      kind: 'entry',
      id: entry.relPath,
      entry: { ...entry, name: entry.relPath },
      depth: 0,
      parentPath: EXPLORE_ROOT_PATH,
      isExpanded: false,
    }));
};
