import type { SessionArtifact } from '@goodboy/types';
import { artifactFileSlug } from './hooks/useArtifactExport/artifactFileSlug';

const ID_SUFFIX_LENGTH = 6;

export const artifactFolderName = ({
  artifact,
}: {
  readonly artifact: Pick<SessionArtifact, 'id' | 'title' | 'createdAt'>;
}): string => {
  const date = artifact.createdAt.slice(0, 10);
  const suffix = artifact.id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-ID_SUFFIX_LENGTH)
    .toLowerCase();
  return [date, artifactFileSlug({ title: artifact.title }), suffix]
    .filter((part) => part.length > 0)
    .join('-');
};
