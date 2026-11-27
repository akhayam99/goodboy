import type { ColumnActions } from '../../ShellLeft/columnDoors';

const noop = () => undefined;

export const SCENE_COLUMN_ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openConnections: noop,
  openCalendar: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};
