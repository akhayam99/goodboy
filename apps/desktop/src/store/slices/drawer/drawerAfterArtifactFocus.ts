import type { ArtifactId } from '@goodboy/types';
import type { OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null | undefined;
  readonly artifactId: ArtifactId | null;
};

export const drawerAfterArtifactFocus = ({ drawer, artifactId }: Params): OpenDrawer | null => {
  const current = drawer ?? null;
  if (current === null || current.kind !== 'artifact') {
    return current;
  }
  return current.payload.artifactId === artifactId ? current : null;
};
