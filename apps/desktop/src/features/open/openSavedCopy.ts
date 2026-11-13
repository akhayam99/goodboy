import type { SessionArtifact } from '@goodboy/types';
import { artifactFolderName } from '../artifacts/artifactFolderName';
import { openTargetOrThrow } from './openTargetOrThrow';
import { PLAIN_CLICK } from './plainClick';
import type { OpenClick } from './types';

type Params = {
  readonly artifact: SessionArtifact;
  readonly workspaceSlug: string;
  readonly file: string;
  readonly event?: OpenClick;
};

export const openSavedCopy = ({
  artifact,
  workspaceSlug,
  file,
  event = PLAIN_CLICK,
}: Params): Promise<void> =>
  openTargetOrThrow({
    target: {
      kind: 'saved-copy',
      copy: artifact.kind === 'wireframe' ? 'wireframe' : 'document',
      name: artifact.title,
      workspaceSlug,
      folder: artifactFolderName({ artifact }),
      file,
    },
    sessionId: artifact.sessionId,
    event,
  });
