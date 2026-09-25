import { markArtifactOpened } from '@goodboy/db';
import type { ArtifactId } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';

export const ARTIFACT_OPENED_DEBOUNCE_MS = 10 * 60 * 1000;

const lastWrites = new Map<ArtifactId, number>();

type Params = {
  readonly artifactId: ArtifactId;
  readonly now?: number;
};

export const recordArtifactOpened = async ({
  artifactId,
  now = Date.now(),
}: Params): Promise<boolean> => {
  const last = lastWrites.get(artifactId);
  if (last !== undefined && now - last < ARTIFACT_OPENED_DEBOUNCE_MS) {
    return false;
  }
  lastWrites.set(artifactId, now);
  await markArtifactOpened({ db: tauriDatabase, artifactId, openedAt: now });
  return true;
};

export const resetArtifactOpenedDebounce = (): void => lastWrites.clear();
