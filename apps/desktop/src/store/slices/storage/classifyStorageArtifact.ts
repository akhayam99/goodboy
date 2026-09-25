import { STORAGE_DAY_MS } from './classifyStorageFolder';
import type { StorageArtifact, StorageArtifactFilter } from './types';

type ArtifactParams = {
  readonly artifact: StorageArtifact;
};

type ArtifactAtParams = ArtifactParams & {
  readonly now: number;
};

type SuggestParams = ArtifactAtParams & {
  readonly suggestAfterDays: number;
};

export const storageArtifactLastUsed = ({ artifact }: ArtifactParams): number =>
  Math.max(artifact.openedAt ?? 0, artifact.updatedAt);

export const isStorageArtifactKept = ({ artifact, now }: ArtifactAtParams): boolean => {
  if (artifact.keptAt === null) {
    return false;
  }
  return artifact.keptUntil === null || artifact.keptUntil > now;
};

export const storageArtifactFilter = ({
  artifact,
  now,
}: ArtifactAtParams): StorageArtifactFilter =>
  isStorageArtifactKept({ artifact, now }) ? 'kept' : 'review';

export const isStorageArtifactRecentlyDeleted = ({
  artifact,
  now,
  suggestAfterDays,
}: SuggestParams): boolean => now - artifact.deletedAt < suggestAfterDays * STORAGE_DAY_MS;

export const isStorageArtifactRecentlyUsed = ({
  artifact,
  now,
  suggestAfterDays,
}: SuggestParams): boolean =>
  now - storageArtifactLastUsed({ artifact }) < 2 * suggestAfterDays * STORAGE_DAY_MS;

export const isStorageArtifactSuggested = (params: SuggestParams): boolean =>
  storageArtifactFilter(params) === 'review' &&
  !isStorageArtifactRecentlyDeleted(params) &&
  !isStorageArtifactRecentlyUsed(params);
