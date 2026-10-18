import type { FolderSize } from './fileVersions';

type Params = Readonly<{
  size: FolderSize;
}>;

export type FolderHistorySize = Readonly<{
  usedBytes: number;
  capBytes: number;
  usedShare: number;
  versionCount: number;
}>;

export const folderHistorySize = ({ size }: Params): FolderHistorySize => {
  const capBytes = Math.max(size.capBytes, 1);
  return {
    usedBytes: size.versionBytes,
    capBytes: size.capBytes,
    usedShare: Math.min(1, size.versionBytes / capBytes),
    versionCount: size.versionCount,
  };
};
