import { CircleCheck, HardDrive, TriangleAlert } from 'lucide-react';
import { Skeleton, cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { StorageScope } from '../../../../store/slices/storage/types';
import { useStorageSummary } from '../../useStorageSummary';
import { StorageLegendItem, type StorageSegment } from './StorageLegendItem';

const LOW_DISK_BYTES = 10 * 1024 ** 3;

type Props = {
  readonly scope: StorageScope;
  readonly onScopeToAll: () => void;
};

export const StorageSummary = ({ scope, onScopeToAll }: Props) => {
  const stats = useAppStore((state) => state.storageStats);
  const isLoading = useAppStore((state) => state.storageStatsLoading);
  const artifacts = useAppStore((state) => state.storageArtifacts);
  const { summary } = useStorageSummary({ scope });
  const { summary: allSummary } = useStorageSummary();
  const isScoped = scope.kind !== 'all';

  if (stats === null) {
    return isLoading ? <Skeleton className="h-24 w-full" /> : null;
  }

  const appDataBytes = stats.databaseBytes + stats.snapshotBytes;
  const artifactBytes = artifacts.reduce((sum, artifact) => sum + (artifact.sizeBytes ?? 0), 0);
  const segments: ReadonlyArray<StorageSegment> = [
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
      key: 'kept',
      label: 'Keep',
      bytes: summary.kept.bytes,
      detail: pluralize(summary.kept.count, 'folder'),
      swatch: 'bg-idle',
      target: 'storage-worktrees',
    },
  ];
  const total =
    summary.inUse.bytes +
    summary.canGo.bytes +
    summary.reviewFirst.bytes +
    summary.kept.bytes +
    (isScoped ? 0 : appDataBytes) +
    stats.archivedTranscriptBytes +
    artifactBytes;
  const free = stats.diskFreeBytes;
  const isLowDisk = free !== null && free < LOW_DISK_BYTES;

  return (
    <section aria-label="Storage summary" className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-display tabular-nums text-foreground">
          {formatBytes({ bytes: total })}
        </span>
        <span className={cn('flex items-center gap-1 text-heading', tintClasses('primary').text)}>
          <CircleCheck size={ICON_SIZE.row} aria-hidden />
          {formatBytes({ bytes: summary.canGo.bytes })} can go
        </span>
        {free === null ? null : (
          <span
            className={cn(
              'ml-auto flex items-center gap-2 text-label',
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
      {isScoped ? (
        <button
          type="button"
          onClick={onScopeToAll}
          className="self-start text-label text-faint-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          All workspaces:{' '}
          {formatBytes({
            bytes: allSummary.inUse.bytes + allSummary.review.bytes + allSummary.kept.bytes,
          })}
          , {formatBytes({ bytes: allSummary.canGo.bytes })} can go
        </button>
      ) : null}
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
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 @min-[560px]:grid-cols-3">
        {segments.map((segment) => (
          <StorageLegendItem key={segment.key} segment={segment} />
        ))}
      </div>
      {isScoped ? (
        <p className="text-meta text-faint-foreground">
          Plus {formatBytes({ bytes: appDataBytes })} of app data shared by every workspace.
        </p>
      ) : null}
    </section>
  );
};
