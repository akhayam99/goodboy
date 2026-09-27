import type { ArtifactId } from '@goodboy/types';
import { openArtifactMirror } from '../../../features/artifacts/artifactMirror/artifactMirrorInvoke';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly id: ArtifactId;
};

const MIRROR_INDEX_FILE = 'index.html';

export const openStorageArtifact = (set: SetFn, get: GetFn) => {
  return async ({ id }: Params): Promise<void> => {
    const artifact = get().storageArtifacts.find((candidate) => candidate.id === id);
    if (artifact === undefined) {
      return;
    }
    await openArtifactMirror({
      workspaceSlug: artifact.workspaceSlug,
      folder: artifact.folder,
      file: MIRROR_INDEX_FILE,
    });
    const openedAt = Date.now();
    set((state) => ({
      storageArtifacts: state.storageArtifacts.map((candidate) =>
        candidate.id === id ? { ...candidate, openedAt } : candidate,
      ),
    }));
  };
};
