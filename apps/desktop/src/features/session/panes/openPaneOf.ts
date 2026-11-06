import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { DRAWER_KINDS } from '../../../store/slices/drawer/drawerKinds';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import type { ClusterPane } from './clusterPane';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'currentSessionId'>;
  readonly sessionId: SessionId;
};

type OpenerParams = {
  readonly drawer: OpenDrawer;
};

const openerOf = ({ drawer }: OpenerParams): string | null =>
  drawer.payload !== null && 'from' in drawer.payload ? (drawer.payload.from ?? null) : null;

export const openPaneOf = ({ state, sessionId }: Params): ClusterPane | null => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null || drawer.sessionId !== sessionId) {
    return null;
  }
  const row = DRAWER_KINDS[drawer.kind];
  if (row.pane !== null) {
    return row.pane;
  }
  if (row.openerPane !== null && openerOf({ drawer }) === row.openerPane) {
    return row.openerPane;
  }
  return null;
};
