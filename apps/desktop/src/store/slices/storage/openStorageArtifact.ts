import type { ArtifactId } from '@goodboy/types';
import { openArtifactWindow } from '../../../features/artifacts/openArtifactWindow';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly id: ArtifactId;
};

export const openStorageArtifact = (set: SetFn, get: GetFn) => {
  return async ({ id }: Params): Promise<void> => {
    const artifact = get().storageArtifacts.find((candidate) => candidate.id === id);
    if (artifact === undefined) {
      return;
    }
    await openArtifactWindow({
      sessionId: artifact.sessionId,
      artifactId: artifact.id,
      title: artifact.title,
      mode: 'read',
    });
    const openedAt = Date.now();
    set((state) => ({
      storageArtifacts: state.storageArtifacts.map((candidate) =>
        candidate.id === id ? { ...candidate, openedAt } : candidate,
      ),
    }));
  };
};
