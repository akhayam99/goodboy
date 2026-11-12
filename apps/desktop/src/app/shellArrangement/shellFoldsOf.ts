import { LEFT_SIDEBAR_DEFAULT, isRailFoldNeeded, type DrawerSizing } from '@goodboy/ui';
import { SESSION_TOOL_RAIL_WIDTH } from '../../features/session/components/SessionTools/sessionToolRailWidth';

type Params = {
  readonly paneSizing: DrawerSizing | null;
  readonly columnWidth?: number | null;
  readonly railWidth?: number;
  readonly toolsWidth?: number;
  readonly drawerWidth?: number;
};

export type ShellFolds = { readonly isRailNarrow: boolean };

export const shellFoldsOf = ({
  paneSizing,
  columnWidth = null,
  railWidth = LEFT_SIDEBAR_DEFAULT,
  toolsWidth = SESSION_TOOL_RAIL_WIDTH,
  drawerWidth,
}: Params): ShellFolds => ({
  isRailNarrow:
    paneSizing === 'reader' ||
    paneSizing === 'browser' ||
    (paneSizing === 'side' &&
      columnWidth !== null &&
      isRailFoldNeeded({
        mainWidthPx: columnWidth - railWidth - toolsWidth,
        drawerWidthPx: drawerWidth,
        sizing: paneSizing,
      })),
});
