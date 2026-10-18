import type { StorageStats } from '../../store/slices/storage/types';

type Params = Readonly<{
  stats: Pick<StorageStats, 'databaseBytes' | 'snapshotBytes' | 'savedVersionsBytes'>;
}>;

export const appDataBytesOf = ({ stats }: Params): number =>
  stats.databaseBytes + stats.snapshotBytes + stats.savedVersionsBytes;
