import type { Place } from '../navigation/types';
import { DRAWER_KINDS } from './drawerKinds';
import { dockScopeOf } from './dockScopeOf';
import type { DockScope } from './dockScopeState';
import { isWorkspaceTool } from './isWorkspaceTool';
import type { OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly place: Place;
  readonly scope: DockScope | undefined;
};

export const keptTool = ({ drawer, place, scope }: Params): OpenDrawer | null => {
  if (drawer === null) {
    return null;
  }
  if (isWorkspaceTool({ content: drawer })) {
    return scope === undefined || scope === dockScopeOf({ place }) ? drawer : null;
  }
  if (place.at !== 'session' || place.sessionId !== drawer.sessionId) {
    return null;
  }
  const row = DRAWER_KINDS[drawer.kind];
  if (row.surface !== 'tool' || row.pane === null) {
    return null;
  }
  return drawer;
};
