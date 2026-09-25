import type { SessionId } from '@goodboy/types';
import type { LensKind } from '../session-view/types';
import type { OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null | undefined;
  readonly sessionId: SessionId | null;
  readonly lens?: LensKind | null;
};

export const drawerAfterMove = ({ drawer, sessionId, lens }: Params): OpenDrawer | null => {
  const current = drawer ?? null;
  if (current === null) {
    return null;
  }
  if (current.sessionId !== sessionId) {
    return lens === undefined ? null : current;
  }
  if (lens !== undefined && lens !== current.lens) {
    return null;
  }
  return current;
};
