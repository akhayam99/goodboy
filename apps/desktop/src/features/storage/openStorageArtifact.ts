import { openTargetOrThrow } from '../open/openTargetOrThrow';
import { PLAIN_CLICK } from '../open/plainClick';
import type { StorageArtifact } from '../../store/slices/storage/types';

type Params = {
  readonly artifact: StorageArtifact;
};

const MIRROR_INDEX_FILE = 'index.html';

export const openStorageArtifact = ({ artifact }: Params): Promise<void> =>
  openTargetOrThrow({
    target: {
      kind: 'saved-copy',
      copy: artifact.kind === 'wireframe' ? 'wireframe' : 'document',
      name: artifact.title,
      workspaceSlug: artifact.workspaceSlug,
      folder: artifact.folder,
      file: MIRROR_INDEX_FILE,
    },
    sessionId: artifact.sessionId,
    event: PLAIN_CLICK,
    place: 'outside',
  });
