import { DRAWER_KINDS } from '../../../store/slices/drawer/drawerKinds';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import type { ClusterPane } from './clusterPane';

type Params = {
  readonly drawer: OpenDrawer;
};

const openerOf = ({ drawer }: Params): string | null =>
  drawer.payload !== null && 'from' in drawer.payload ? (drawer.payload.from ?? null) : null;

export const paneOfDrawer = ({ drawer }: Params): ClusterPane | null => {
  const row = DRAWER_KINDS[drawer.kind];
  if (row.pane !== null) {
    return row.pane;
  }
  if (row.openerPane !== null && openerOf({ drawer }) === row.openerPane) {
    return row.openerPane;
  }
  return null;
};
