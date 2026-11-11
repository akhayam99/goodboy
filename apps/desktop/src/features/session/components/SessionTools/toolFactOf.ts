import type { ClusterPane } from '../../panes/clusterPane';

type Params = {
  readonly pane: ClusterPane;
  readonly runningCount: number;
  readonly tabCount: number;
};

export const toolFactOf = ({ pane, runningCount, tabCount }: Params): string | null => {
  if (pane === 'terminal' && runningCount > 0) {
    return `${runningCount} running`;
  }
  if (pane === 'browser' && tabCount > 0) {
    return tabCount === 1 ? '1 tab' : `${tabCount} tabs`;
  }
  return null;
};
