import type { RailToolId } from './sessionTools';

type Params = {
  readonly pane: RailToolId;
  readonly runningCount: number;
  readonly tabCount: number | null;
  readonly portsFact: string | null;
  readonly isSessionMissing: boolean;
};

export const toolFactOf = ({
  pane,
  runningCount,
  tabCount,
  portsFact,
  isSessionMissing,
}: Params): string | null => {
  if (isSessionMissing) {
    return 'open a session to ask about it';
  }
  if (pane === 'terminal' && runningCount > 0) {
    return `${runningCount} running`;
  }
  if (pane === 'browser' && tabCount !== null && tabCount > 0) {
    return tabCount === 1 ? '1 tab' : `${tabCount} tabs`;
  }
  if (pane === 'monitoring') {
    return portsFact;
  }
  return null;
};
