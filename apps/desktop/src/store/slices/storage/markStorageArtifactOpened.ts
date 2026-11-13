import type { ArtifactId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly id: ArtifactId;
};

export const markStorageArtifactOpened = ({ set }: SliceDeps) => {
  return async ({ id }: Params): Promise<void> => {
    const openedAt = Date.now();
    set((state) => ({
      storageArtifacts: state.storageArtifacts.map((candidate) =>
        candidate.id === id ? { ...candidate, openedAt } : candidate,
      ),
    }));
  };
};
