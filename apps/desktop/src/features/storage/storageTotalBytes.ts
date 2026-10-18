import type { StorageArtifact, StorageStats } from '../../store/slices/storage/types';
import type { StorageSummary } from '../../store/slices/storage/summarizeStorage';
import { appDataBytesOf } from './appDataBytesOf';

type Params = {
  readonly stats: StorageStats;
  readonly artifacts: ReadonlyArray<Pick<StorageArtifact, 'sizeBytes'>>;
  readonly summary: StorageSummary;
  readonly isScoped: boolean;
};

export const storageTotalBytes = ({ stats, artifacts, summary, isScoped }: Params): number => {
  const appDataBytes = appDataBytesOf({ stats });
  const artifactBytes = artifacts.reduce((sum, artifact) => sum + (artifact.sizeBytes ?? 0), 0);
  return (
    summary.inUse.bytes +
    summary.canGo.bytes +
    summary.reviewFirst.bytes +
    summary.kept.bytes +
    (isScoped ? 0 : appDataBytes) +
    stats.archivedTranscriptBytes +
    artifactBytes
  );
};
