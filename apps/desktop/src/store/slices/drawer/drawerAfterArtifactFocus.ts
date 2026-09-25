import type { ArtifactId } from '@goodboy/types';
import type { OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null | undefined;
  readonly artifactId: ArtifactId | null;
};

export const drawerAfterArtifactFocus = ({ drawer, artifactId }: Params): OpenDrawer | null => {
  const current = drawer ?? null;
  if (current === null) {
    return null;
  }
  if (current.kind === 'artifact') {
    return current.payload.artifactId === artifactId ? current : null;
  }
  if (current.kind === 'plan-part') {
    return current.payload.planId === artifactId ? current : null;
  }
  return current;
};
