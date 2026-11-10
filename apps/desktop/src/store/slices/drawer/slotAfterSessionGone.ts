import type { SessionId } from '@goodboy/types';
import { isWorkspaceTool } from './isWorkspaceTool';
import type { DrawerSliceState, OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly sessionId: SessionId;
};

type KeepParams = {
  readonly entry: OpenDrawer | null;
  readonly sessionId: SessionId;
};

const keptEntry = ({ entry, sessionId }: KeepParams): OpenDrawer | null =>
  entry !== null && entry.sessionId === sessionId && isWorkspaceTool({ content: entry })
    ? null
    : entry;

export const slotAfterSessionGone = ({ drawer, back, sessionId }: Params): DrawerSliceState => {
  const top = keptEntry({ entry: drawer, sessionId });
  const below = keptEntry({ entry: back, sessionId });
  return top === null ? { drawer: below, drawerBack: null } : { drawer: top, drawerBack: below };
};
