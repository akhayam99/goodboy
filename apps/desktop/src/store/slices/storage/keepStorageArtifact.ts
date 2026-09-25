import { setArtifactKeep } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { STORAGE_DAY_MS } from './classifyStorageFolder';
import type { GetFn, KeepStorageArtifactParams, SetFn } from './types';

export const keepStorageArtifact = (set: SetFn, get: GetFn) => {
  return async ({ id, days, isStopping = false }: KeepStorageArtifactParams): Promise<void> => {
    if (!get().storageArtifacts.some((artifact) => artifact.id === id)) {
      return;
    }
    const now = Date.now();
    const keptAt = isStopping ? null : now;
    const keptUntil = isStopping || days === null ? null : now + days * STORAGE_DAY_MS;
    await setArtifactKeep({ db: tauriDatabase, artifactId: id, keptAt, keptUntil });
    set((state) => ({
      storageArtifacts: state.storageArtifacts.map((artifact) =>
        artifact.id === id ? { ...artifact, keptAt, keptUntil } : artifact,
      ),
    }));
  };
};
