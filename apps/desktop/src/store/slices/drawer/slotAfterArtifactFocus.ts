import type { ArtifactId, SessionId } from '@goodboy/types';
import type { DrawerSliceState, OpenDrawer } from './state';

type Params = {
  readonly sessionId: SessionId;
  readonly drawer: OpenDrawer | null | undefined;
  readonly back: OpenDrawer | null | undefined;
  readonly artifactId: ArtifactId | null;
};

type FocusParams = {
  readonly sessionId: SessionId;
  readonly current: OpenDrawer;
  readonly artifactId: ArtifactId | null;
};

const isFocusLost = ({ sessionId, current, artifactId }: FocusParams): boolean => {
  if (current.sessionId !== sessionId) {
    return false;
  }
  if (current.kind === 'artifact') {
    return current.payload.artifactId !== artifactId;
  }
  if (current.kind === 'plan-part') {
    return current.payload.planId !== artifactId;
  }
  return false;
};

export const slotAfterArtifactFocus = ({
  sessionId,
  drawer,
  back,
  artifactId,
}: Params): DrawerSliceState => {
  const current = drawer ?? null;
  const chipped = back ?? null;
  const waiting =
    chipped !== null && isFocusLost({ sessionId, current: chipped, artifactId }) ? null : chipped;
  if (current === null || !isFocusLost({ sessionId, current, artifactId })) {
    return { drawer: current, drawerBack: waiting };
  }
  return { drawer: waiting, drawerBack: null };
};
