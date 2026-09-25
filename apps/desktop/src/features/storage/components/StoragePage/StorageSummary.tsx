import { CircleCheck, HardDrive, TriangleAlert } from 'lucide-react';
import { Skeleton, cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useStorageSummary } from '../../useStorageSummary';
import { StorageLegendItem, type StorageSegment } from './StorageLegendItem';

const LOW_DISK_BYTES = 10 * 1024 ** 3;

export const StorageSummary = () => {
  const stats = useAppStore((state) => state.storageStats);
  const isLoading = useAppStore((state) => state.storageStatsLoading);
  const artifacts = useAppStore((state) => state.storageArtifacts);
  const { summary } = useStorageSummary();

  if (stats === null) {
    return isLoading ? <Skeleton className="h-24 w-full" /> : null;
  }

  const appDataBytes = stats.databaseBytes + stats.snapshotBytes;
  const artifactBytes = artifacts.reduce((sum, artifact) => sum + (artifact.sizeBytes ?? 0), 0);
  const segments: ReadonlyArray<StorageSegment> = [
    {
      key: 'in-use',
      label: 'In use',
      bytes: summary.inUse.bytes,
      detail: pluralize(summary.inUse.count, 'folder'),
      swatch: 'bg-idle',
      target: 'storage-worktrees',
    },
    {
      key: 'can-go',
      label: 'Can go',
      bytes: summary.canGo.bytes,
      detail: pluralize(summary.canGo.count, 'folder'),
      swatch: 'bg-primary',
      target: 'storage-worktrees',
    },
    {
      key: 'review',
      label: 'Review first',
      bytes: summary.reviewFirst.bytes,
      detail: pluralize(summary.reviewFirst.count, 'folder'),
      swatch: 'bg-warning',
      target: 'storage-worktrees',
    },
    {
      key: 'app-data',
      label: 'App data',
      bytes: appDataBytes,
      detail: 'database',
      swatch: 'bg-faint-foreground',
      target: 'storage-history',
    },
    {
      key: 'transcripts',
      label: 'Transcripts',
      bytes: stats.archivedTranscriptBytes,
      detail: `${stats.archivedSessionCount} archived`,
      swatch: 'bg-muted-foreground',
      target: 'storage-history',
    },
    {
      key: 'artifacts',
      label: 'Artifact copies',
      bytes: artifactBytes,
      detail: artifacts.length === 1 ? '1 copy' : `${artifacts.length} copies`,
      swatch: 'bg-info',
      target: 'storage-artifacts',
    },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.bytes, 0);
  const free = stats.diskFreeBytes;
  const isLowDisk = free !== null && free < LOW_DISK_BYTES;

  return (
    <section aria-label="Storage summary" className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {formatBytes({ bytes: total })}
        </span>
        <span
          className={cn(
            'flex items-center gap-1 text-sm font-semibold',
            tintClasses('primary').text,
          )}
        >
          <CircleCheck size={ICON_SIZE.row} aria-hidden />
          {formatBytes({ bytes: summary.canGo.bytes })} can go
        </span>
        {free === null ? null : (
          <span
            className={cn(
              'ml-auto flex items-center gap-1.5 text-xs',
              isLowDisk ? tintClasses('warning').text : 'text-muted-foreground',
            )}
          >
            {isLowDisk ? (
              <TriangleAlert size={ICON_SIZE.row} aria-hidden />
            ) : (
              <HardDrive size={ICON_SIZE.row} aria-hidden />
            )}
            {isLowDisk ? 'Low space: ' : ''}
            {formatBytes({ bytes: free })} free on this disk
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label="Storage by category"
        className="flex h-3 gap-0.5 overflow-hidden rounded-md bg-muted"
      >
        {segments.map((segment) =>
          segment.bytes === 0 || total === 0 ? null : (
            <i
              key={segment.key}
              className={cn('block h-full min-w-0.5', segment.swatch)}
              style={{ width: `${(segment.bytes / total) * 100}%` }}
            />
          ),
        )}
      </div>
      <div className="grid grid-cols-1 gap-x-7 gap-y-1.5 @min-[560px]:grid-cols-3">
        {segments.map((segment) => (
          <StorageLegendItem key={segment.key} segment={segment} />
        ))}
      </div>
    </section>
  );
};
