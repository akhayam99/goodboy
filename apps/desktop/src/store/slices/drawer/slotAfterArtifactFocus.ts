import type { ArtifactId } from '@goodboy/types';
import type { DrawerSliceState, OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null | undefined;
  readonly back: OpenDrawer | null | undefined;
  readonly artifactId: ArtifactId | null;
};

type FocusParams = {
  readonly current: OpenDrawer;
  readonly artifactId: ArtifactId | null;
};

const isFocusLost = ({ current, artifactId }: FocusParams): boolean => {
  if (current.kind === 'artifact') {
    return current.payload.artifactId !== artifactId;
  }
  if (current.kind === 'plan-part') {
    return current.payload.planId !== artifactId;
  }
  return false;
};

export const slotAfterArtifactFocus = ({ drawer, back, artifactId }: Params): DrawerSliceState => {
  const current = drawer ?? null;
  const chipped = back ?? null;
  const waiting =
    chipped !== null && isFocusLost({ current: chipped, artifactId }) ? null : chipped;
  if (current === null || !isFocusLost({ current, artifactId })) {
    return { drawer: current, drawerBack: waiting };
  }
  return { drawer: waiting, drawerBack: null };
};
