import type { ClusterPane } from '../../panes/clusterPane';

type RailFocus = {
  pane: ClusterPane | null;
  hasFocus: boolean;
  isDrawerOpener: boolean;
};

export const railFocusMemo: RailFocus = { pane: null, hasFocus: false, isDrawerOpener: false };
