import type { FileVersion, IsoDateTime } from '@goodboy/types';

export type FileVersionGroup = Readonly<{
  relativePath: string;
  count: number;
  lastCapturedAt: IsoDateTime;
  versions: ReadonlyArray<FileVersion>;
}>;

type Params = Readonly<{
  versions: ReadonlyArray<FileVersion>;
}>;

export const fileVersionGroups = ({ versions }: Params): ReadonlyArray<FileVersionGroup> => {
  const grouped = new Map<string, Array<FileVersion>>();
  for (const version of versions) {
    const existing = grouped.get(version.relativePath);
    if (existing != null) {
      existing.push(version);
      continue;
    }
    grouped.set(version.relativePath, [version]);
  }
  return Array.from(grouped.entries())
    .map(([relativePath, entries]) => ({
      relativePath,
      count: entries.length,
      lastCapturedAt: entries[0]!.capturedAt,
      versions: entries,
    }))
    .sort((left, right) => right.lastCapturedAt.localeCompare(left.lastCapturedAt));
};
